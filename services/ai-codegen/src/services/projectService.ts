import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs-extra';
import * as path from 'path';
import archiver from 'archiver';
import simpleGit, { SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';
import { getRedisClient } from './redisService';
import {
  GeneratedCode,
  GeneratedProject,
  ProjectFile,
  ProjectStatus,
  GitRepository,
  DeploymentInfo,
  FileType
} from '../types';
import crypto from 'crypto';

class ProjectService {
  private projectsPath: string;
  private git: SimpleGit;
  private octokit: Octokit | null = null;

  constructor() {
    this.projectsPath = process.env.PROJECTS_PATH || path.join(process.cwd(), 'generated-projects');
    this.git = simpleGit();

    // Initialize GitHub client if token is provided
    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
      });
    }

    // Ensure projects directory exists
    fs.ensureDirSync(this.projectsPath);
  }

  /**
   * Save generated code as a project
   */
  async saveProject(generatedCode: GeneratedCode, metadata: any = {}): Promise<GeneratedProject> {
    const projectId = uuidv4();
    const projectPath = path.join(this.projectsPath, projectId);

    try {
      // Create project directory
      await fs.ensureDir(projectPath);

      // Save files
      const files: ProjectFile[] = [];
      for (const [filePath, content] of generatedCode.files) {
        const fullPath = path.join(projectPath, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content, 'utf-8');

        files.push({
          path: filePath,
          content,
          type: this.getFileType(filePath),
          size: Buffer.byteLength(content, 'utf-8'),
          checksum: this.calculateChecksum(content)
        });
      }

      // Create project record
      const project: GeneratedProject = {
        id: projectId,
        name: generatedCode.projectName,
        description: metadata.description || '',
        type: metadata.type || 'web-app',
        framework: metadata.framework || 'react',
        language: metadata.language || 'typescript',
        status: ProjectStatus.GENERATED,
        files,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...metadata,
          dependencies: generatedCode.dependencies,
          scripts: generatedCode.scripts
        }
      };

      // Save project metadata to Redis
      const redis = getRedisClient();
      await redis.set(`project:${projectId}`, JSON.stringify(project));
      await redis.sadd('projects', projectId);

      // Initialize git repository if enabled
      if (process.env.ENABLE_GIT === 'true') {
        await this.initializeGitRepo(projectPath, project);
      }

      logger.info(`Project saved: ${projectId}`);
      return project;

    } catch (error) {
      logger.error('Error saving project:', error);
      // Clean up on failure
      await fs.remove(projectPath);
      throw error;
    }
  }

  /**
   * Save a generated component
   */
  async saveComponent(generatedCode: GeneratedCode): Promise<any> {
    const componentId = uuidv4();
    const componentPath = path.join(this.projectsPath, 'components', componentId);

    try {
      await fs.ensureDir(componentPath);

      // Save component files
      for (const [filePath, content] of generatedCode.files) {
        const fullPath = path.join(componentPath, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content, 'utf-8');
      }

      const component = {
        id: componentId,
        name: generatedCode.projectName,
        files: Array.from(generatedCode.files.keys()),
        createdAt: new Date()
      };

      // Save to Redis
      const redis = getRedisClient();
      await redis.set(`component:${componentId}`, JSON.stringify(component));
      await redis.sadd('components', componentId);

      return component;

    } catch (error) {
      logger.error('Error saving component:', error);
      await fs.remove(componentPath);
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<GeneratedProject | null> {
    const redis = getRedisClient();
    const projectData = await redis.get(`project:${projectId}`);

    if (!projectData) {
      return null;
    }

    return JSON.parse(projectData);
  }

  /**
   * List all projects
   */
  async listProjects(limit: number = 20, offset: number = 0): Promise<GeneratedProject[]> {
    const redis = getRedisClient();
    const projectIds = await redis.smembers('projects');

    const projects: GeneratedProject[] = [];
    for (const projectId of projectIds.slice(offset, offset + limit)) {
      const project = await this.getProject(projectId);
      if (project) {
        projects.push(project);
      }
    }

    // Sort by creation date
    projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return projects;
  }

  /**
   * Update project status
   */
  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    const project = await this.getProject(projectId);
    if (project) {
      project.status = status;
      project.updatedAt = new Date();

      const redis = getRedisClient();
      await redis.set(`project:${projectId}`, JSON.stringify(project));
    }
  }

  /**
   * Export project as ZIP
   */
  async exportProject(projectId: string): Promise<Buffer> {
    const projectPath = path.join(this.projectsPath, projectId);

    if (!await fs.pathExists(projectPath)) {
      throw new Error('Project not found');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      archive.directory(projectPath, false);
      archive.finalize();
    });
  }

  /**
   * Initialize Git repository for project
   */
  private async initializeGitRepo(projectPath: string, project: GeneratedProject): Promise<void> {
    try {
      const git = simpleGit(projectPath);

      // Initialize repository
      await git.init();

      // Add all files
      await git.add('.');

      // Create initial commit
      await git.commit(`Initial commit: ${project.name}

Generated by TrinityAI Code Generation Service
Project Type: ${project.type}
Framework: ${project.framework}
Language: ${project.language}`);

      logger.info(`Git repository initialized for project ${project.id}`);

    } catch (error) {
      logger.error('Error initializing git repository:', error);
      // Non-critical error, continue
    }
  }

  /**
   * Push project to GitHub
   */
  async pushToGitHub(projectId: string, repoName: string, isPrivate: boolean = false): Promise<GitRepository | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not configured');
    }

    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const projectPath = path.join(this.projectsPath, projectId);

    try {
      // Create GitHub repository
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: project.description,
        private: isPrivate,
        auto_init: false
      });

      // Set up git remote and push
      const git = simpleGit(projectPath);
      await git.addRemote('origin', repo.clone_url);
      await git.push('origin', 'main', ['--set-upstream']);

      // Get latest commit
      const log = await git.log(['--max-count=1']);
      const latestCommit = log.latest?.hash || '';

      const gitRepo: GitRepository = {
        url: repo.html_url,
        branch: 'main',
        commit: latestCommit,
        provider: 'github'
      };

      // Update project with repository info
      project.repository = gitRepo;
      const redis = getRedisClient();
      await redis.set(`project:${projectId}`, JSON.stringify(project));

      logger.info(`Project ${projectId} pushed to GitHub: ${repo.html_url}`);
      return gitRepo;

    } catch (error) {
      logger.error('Error pushing to GitHub:', error);
      throw error;
    }
  }

  /**
   * Deploy project to platform
   */
  async deployProject(projectId: string, platform: string, config: any): Promise<DeploymentInfo> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Update status
    await this.updateProjectStatus(projectId, ProjectStatus.DEPLOYING);

    try {
      // Platform-specific deployment logic would go here
      // This is a placeholder implementation

      const deployment: DeploymentInfo = {
        platform: config.platform,
        url: `https://${project.name}.${platform}.app`,
        status: 'pending',
        environment: config.environment || 'development',
        config
      };

      // Simulate deployment (in real implementation, would call platform APIs)
      setTimeout(async () => {
        deployment.status = 'success';
        project.deployment = deployment;
        project.status = ProjectStatus.DEPLOYED;

        const redis = getRedisClient();
        await redis.set(`project:${projectId}`, JSON.stringify(project));
      }, 5000);

      return deployment;

    } catch (error) {
      await this.updateProjectStatus(projectId, ProjectStatus.FAILED);
      throw error;
    }
  }

  /**
   * Get file type based on extension
   */
  private getFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath).toLowerCase();

    if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'].includes(ext)) {
      return FileType.SOURCE;
    }
    if (['.json', '.yml', '.yaml', '.toml', '.env'].includes(ext) ||
        ['dockerfile', '.dockerignore', '.gitignore'].includes(name)) {
      return FileType.CONFIG;
    }
    if (['.test.ts', '.test.js', '.spec.ts', '.spec.js', '_test.py'].some(suffix => filePath.includes(suffix))) {
      return FileType.TEST;
    }
    if (['.md', '.mdx', '.txt', '.rst'].includes(ext)) {
      return FileType.DOCUMENTATION;
    }
    if (['.css', '.scss', '.sass', '.less', '.png', '.jpg', '.svg', '.ico'].includes(ext)) {
      return FileType.ASSET;
    }
    if (['deployment.yml', 'k8s.yml', '.github/workflows'].some(part => filePath.includes(part))) {
      return FileType.DEPLOYMENT;
    }

    return FileType.SOURCE;
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Clean up old projects
   */
  async cleanupOldProjects(daysOld: number = 30): Promise<number> {
    const projects = await this.listProjects(1000, 0);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;
    for (const project of projects) {
      if (new Date(project.createdAt) < cutoffDate &&
          project.status !== ProjectStatus.DEPLOYED) {

        // Delete project files
        const projectPath = path.join(this.projectsPath, project.id);
        await fs.remove(projectPath);

        // Delete from Redis
        const redis = getRedisClient();
        await redis.del(`project:${project.id}`);
        await redis.srem('projects', project.id);

        deletedCount++;
        logger.info(`Deleted old project: ${project.id}`);
      }
    }

    return deletedCount;
  }
}

let projectService: ProjectService;

export function getProjectService(): ProjectService {
  if (!projectService) {
    projectService = new ProjectService();
  }
  return projectService;
}