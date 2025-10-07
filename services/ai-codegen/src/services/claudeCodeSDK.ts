/**
 * Claude Code SDK Integration for TrinityAI
 * This service leverages Claude Code SDK's agent capabilities for advanced code generation
 */

import { logger } from '../utils/logger';
import {
  ProjectSpecification,
  GeneratedCode,
  CodeGenerationRequest,
  Feature,
  ComponentType
} from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';

const execAsync = promisify(exec);

interface ClaudeCodeAgent {
  name: string;
  type: 'architect' | 'coder' | 'reviewer' | 'tester' | 'deployer';
  capabilities: string[];
}

interface ClaudeCodeTask {
  agent: string;
  action: string;
  context: any;
  output?: any;
}

class ClaudeCodeSDKService {
  private agents: Map<string, ClaudeCodeAgent>;
  private workspacePath: string;

  constructor() {
    this.workspacePath = process.env.CLAUDE_WORKSPACE || path.join(process.cwd(), 'claude-workspace');
    this.agents = new Map();
    this.initializeAgents();
  }

  /**
   * Initialize Claude Code SDK agents for different tasks
   */
  private initializeAgents() {
    // Architect agent - designs system architecture
    this.agents.set('architect', {
      name: 'System Architect',
      type: 'architect',
      capabilities: [
        'system-design',
        'database-schema',
        'api-design',
        'component-architecture',
        'deployment-strategy'
      ]
    });

    // Coder agent - writes actual code
    this.agents.set('coder', {
      name: 'Code Generator',
      type: 'coder',
      capabilities: [
        'frontend-development',
        'backend-development',
        'api-implementation',
        'database-queries',
        'business-logic'
      ]
    });

    // Reviewer agent - reviews and optimizes code
    this.agents.set('reviewer', {
      name: 'Code Reviewer',
      type: 'reviewer',
      capabilities: [
        'security-analysis',
        'performance-optimization',
        'code-quality',
        'best-practices',
        'refactoring'
      ]
    });

    // Tester agent - generates tests
    this.agents.set('tester', {
      name: 'Test Engineer',
      type: 'tester',
      capabilities: [
        'unit-tests',
        'integration-tests',
        'e2e-tests',
        'test-coverage',
        'test-automation'
      ]
    });

    // Deployer agent - handles deployment
    this.agents.set('deployer', {
      name: 'DevOps Engineer',
      type: 'deployer',
      capabilities: [
        'docker-config',
        'kubernetes-manifests',
        'ci-cd-pipelines',
        'infrastructure-as-code',
        'monitoring-setup'
      ]
    });

    logger.info('Claude Code SDK agents initialized');
  }

  /**
   * Generate a complete application using Claude Code SDK
   * This orchestrates multiple agents to create a full application
   */
  async generateApplication(spec: ProjectSpecification): Promise<GeneratedCode> {
    logger.info(`Starting application generation with Claude Code SDK: ${spec.name}`);

    try {
      // Create workspace for this project
      const projectWorkspace = path.join(this.workspacePath, spec.name);
      await fs.ensureDir(projectWorkspace);

      // Phase 1: Architecture Design
      const architecture = await this.executeClaudeCodeTask({
        agent: 'architect',
        action: 'design-system',
        context: {
          spec,
          workspace: projectWorkspace
        }
      });

      // Phase 2: Generate Code Structure
      const codeStructure = await this.executeClaudeCodeTask({
        agent: 'coder',
        action: 'scaffold-project',
        context: {
          spec,
          architecture,
          workspace: projectWorkspace
        }
      });

      // Phase 3: Implement Features
      const features = await this.implementFeatures(spec.features, projectWorkspace, architecture);

      // Phase 4: Generate Tests
      const tests = await this.executeClaudeCodeTask({
        agent: 'tester',
        action: 'generate-tests',
        context: {
          spec,
          codeStructure,
          features,
          workspace: projectWorkspace
        }
      });

      // Phase 5: Code Review and Optimization
      const optimizedCode = await this.executeClaudeCodeTask({
        agent: 'reviewer',
        action: 'review-and-optimize',
        context: {
          spec,
          codeStructure,
          features,
          tests,
          workspace: projectWorkspace
        }
      });

      // Phase 6: Generate Deployment Configuration
      const deployment = await this.executeClaudeCodeTask({
        agent: 'deployer',
        action: 'create-deployment-config',
        context: {
          spec,
          architecture,
          workspace: projectWorkspace
        }
      });

      // Collect all generated files
      const files = await this.collectGeneratedFiles(projectWorkspace);

      return {
        projectName: spec.name,
        files,
        structure: this.buildProjectStructure(files),
        dependencies: this.extractDependencies(files),
        scripts: this.extractScripts(files),
        documentation: await this.generateDocumentation(spec, architecture, features),
        deployment
      };

    } catch (error) {
      logger.error('Error generating application with Claude Code SDK:', error);
      throw error;
    }
  }

  /**
   * Execute a Claude Code SDK task using the CLI
   * This integrates with the actual Claude Code SDK command-line interface
   */
  private async executeClaudeCodeTask(task: ClaudeCodeTask): Promise<any> {
    const agent = this.agents.get(task.agent);
    if (!agent) {
      throw new Error(`Agent ${task.agent} not found`);
    }

    logger.info(`Executing Claude Code SDK task: ${task.action} with agent: ${agent.name}`);

    // Build the Claude Code SDK command
    const prompt = this.buildPromptForTask(task);
    const command = this.buildClaudeCommand(task.agent, prompt, task.context.workspace);

    try {
      // Execute Claude Code SDK command
      const { stdout, stderr } = await execAsync(command, {
        cwd: task.context.workspace,
        env: {
          ...process.env,
          CLAUDE_CODE_MODE: 'autonomous',
          CLAUDE_CODE_AGENT: task.agent
        }
      });

      if (stderr && !stderr.includes('warning')) {
        logger.warn(`Claude Code SDK stderr: ${stderr}`);
      }

      // Parse the output based on the task type
      return this.parseClaudeOutput(stdout, task.action);

    } catch (error) {
      logger.error(`Error executing Claude Code SDK task ${task.action}:`, error);
      throw error;
    }
  }

  /**
   * Build a prompt for Claude Code SDK based on the task
   */
  private buildPromptForTask(task: ClaudeCodeTask): string {
    const { agent, action, context } = task;

    switch (action) {
      case 'design-system':
        return `
          As a ${agent} agent, design the system architecture for:
          ${JSON.stringify(context.spec, null, 2)}

          Create:
          1. High-level architecture diagram (as code/text)
          2. Component breakdown
          3. Database schema
          4. API structure
          5. Technology stack recommendations

          Output the architecture as structured JSON.
        `;

      case 'scaffold-project':
        return `
          As a ${agent} agent, create the project structure for:
          Project: ${context.spec.name}
          Type: ${context.spec.type}
          Framework: ${context.spec.framework}
          Language: ${context.spec.language}

          Architecture: ${JSON.stringify(context.architecture, null, 2)}

          Generate:
          1. Complete project directory structure
          2. Configuration files (package.json, tsconfig.json, etc.)
          3. Main application entry points
          4. Basic routing/navigation
          5. Database connection setup
          6. Environment configuration
        `;

      case 'implement-feature':
        return `
          As a ${agent} agent, implement the following feature:
          ${JSON.stringify(context.feature, null, 2)}

          In the context of:
          Project: ${context.projectName}
          Architecture: ${JSON.stringify(context.architecture, null, 2)}

          Generate:
          1. Complete feature implementation
          2. All necessary components/modules
          3. API endpoints if needed
          4. Database migrations if needed
          5. Integration with existing code
        `;

      case 'generate-tests':
        return `
          As a ${agent} agent, generate comprehensive tests for:
          Project: ${context.spec.name}
          Code Structure: ${JSON.stringify(context.codeStructure, null, 2)}
          Features: ${JSON.stringify(context.features, null, 2)}

          Create:
          1. Unit tests for all components/functions
          2. Integration tests for APIs
          3. E2E tests for critical user flows
          4. Test configuration and setup files
          5. Test data fixtures
        `;

      case 'review-and-optimize':
        return `
          As a ${agent} agent, review and optimize the code:
          Project: ${context.spec.name}

          Perform:
          1. Security vulnerability scan
          2. Performance optimization
          3. Code quality improvements
          4. Remove dead code
          5. Add missing error handling
          6. Improve type safety
          7. Optimize bundle size

          Apply all improvements directly to the code.
        `;

      case 'create-deployment-config':
        return `
          As a ${agent} agent, create deployment configuration for:
          Project: ${context.spec.name}
          Architecture: ${JSON.stringify(context.architecture, null, 2)}

          Generate:
          1. Dockerfile for containerization
          2. docker-compose.yml for local development
          3. Kubernetes manifests (if applicable)
          4. CI/CD pipeline configuration (GitHub Actions)
          5. Environment variable templates
          6. Deployment scripts
          7. Monitoring and logging setup
        `;

      default:
        return `Execute ${action} for ${JSON.stringify(context, null, 2)}`;
    }
  }

  /**
   * Build the actual Claude Code SDK command
   */
  private buildClaudeCommand(agent: string, prompt: string, workspace: string): string {
    // Save prompt to a temporary file to avoid shell escaping issues
    const promptFile = path.join(workspace, '.claude-prompt.txt');
    fs.writeFileSync(promptFile, prompt);

    // Use Claude Code SDK CLI with appropriate flags
    return `claude-code generate \
      --agent ${agent} \
      --prompt-file ${promptFile} \
      --output ${workspace} \
      --mode autonomous \
      --allow-file-operations \
      --allow-command-execution \
      --format json`;
  }

  /**
   * Parse Claude Code SDK output
   */
  private parseClaudeOutput(output: string, action: string): any {
    try {
      // Claude Code SDK outputs JSON for structured responses
      const lines = output.split('\n');
      const jsonLine = lines.find(line => line.startsWith('{') || line.startsWith('['));

      if (jsonLine) {
        return JSON.parse(jsonLine);
      }

      // For file generation actions, return the output as-is
      if (action.includes('implement') || action.includes('scaffold')) {
        return { success: true, message: output };
      }

      return output;

    } catch (error) {
      logger.warn('Could not parse Claude output as JSON, returning raw output');
      return output;
    }
  }

  /**
   * Implement features using Claude Code SDK
   */
  private async implementFeatures(
    features: Feature[],
    workspace: string,
    architecture: any
  ): Promise<any[]> {
    const implementedFeatures = [];

    for (const feature of features) {
      if (feature.priority === 'high' || feature.priority === 'medium') {
        const result = await this.executeClaudeCodeTask({
          agent: 'coder',
          action: 'implement-feature',
          context: {
            feature,
            projectName: path.basename(workspace),
            architecture,
            workspace
          }
        });
        implementedFeatures.push(result);
      }
    }

    return implementedFeatures;
  }

  /**
   * Generate a specific component using Claude Code SDK
   */
  async generateComponent(request: CodeGenerationRequest): Promise<GeneratedCode> {
    logger.info(`Generating component with Claude Code SDK: ${request.name}`);

    const workspace = path.join(this.workspacePath, 'components', request.name);
    await fs.ensureDir(workspace);

    try {
      // Determine the best agent for this component type
      const agent = this.selectAgentForComponent(request.componentType);

      // Generate the component
      const result = await this.executeClaudeCodeTask({
        agent,
        action: 'generate-component',
        context: {
          request,
          workspace
        }
      });

      // If the component needs tests, generate them
      if (request.componentType !== ComponentType.TEST) {
        await this.executeClaudeCodeTask({
          agent: 'tester',
          action: 'generate-component-tests',
          context: {
            component: request,
            result,
            workspace
          }
        });
      }

      // Collect generated files
      const files = await this.collectGeneratedFiles(workspace);

      return {
        projectName: request.name,
        files,
        structure: this.buildProjectStructure(files),
        dependencies: [],
        scripts: {},
        documentation: '',
        deployment: null
      };

    } catch (error) {
      logger.error('Error generating component:', error);
      throw error;
    }
  }

  /**
   * Select the appropriate agent for a component type
   */
  private selectAgentForComponent(type: ComponentType): string {
    switch (type) {
      case ComponentType.API_ENDPOINT:
      case ComponentType.SERVICE:
      case ComponentType.DATABASE_MODEL:
      case ComponentType.MIDDLEWARE:
        return 'coder';

      case ComponentType.TEST:
        return 'tester';

      case ComponentType.CONFIG:
        return 'deployer';

      default:
        return 'coder';
    }
  }

  /**
   * Collect all generated files from workspace
   */
  private async collectGeneratedFiles(workspace: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    const ignorePatterns = ['.claude-prompt.txt', '.git', 'node_modules', '.DS_Store'];

    async function scanDirectory(dir: string, baseDir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip ignored files/directories
        if (ignorePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, baseDir);
        } else if (entry.isFile()) {
          const relativePath = path.relative(baseDir, fullPath);
          const content = await fs.readFile(fullPath, 'utf-8');
          files.set(relativePath, content);
        }
      }
    }

    await scanDirectory(workspace, workspace);
    return files;
  }

  /**
   * Build project structure from files
   */
  private buildProjectStructure(files: Map<string, string>): any {
    const structure: any = {};

    for (const filePath of files.keys()) {
      const parts = filePath.split(path.sep);
      let current = structure;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = 'file';
    }

    return structure;
  }

  /**
   * Extract dependencies from package.json
   */
  private extractDependencies(files: Map<string, string>): string[] {
    const packageJson = files.get('package.json');
    if (!packageJson) return [];

    try {
      const parsed = JSON.parse(packageJson);
      return Object.keys(parsed.dependencies || {});
    } catch {
      return [];
    }
  }

  /**
   * Extract scripts from package.json
   */
  private extractScripts(files: Map<string, string>): Record<string, string> {
    const packageJson = files.get('package.json');
    if (!packageJson) return {};

    try {
      const parsed = JSON.parse(packageJson);
      return parsed.scripts || {};
    } catch {
      return {};
    }
  }

  /**
   * Generate comprehensive documentation
   */
  private async generateDocumentation(
    spec: ProjectSpecification,
    architecture: any,
    features: any[]
  ): Promise<string> {
    const prompt = `
      Generate comprehensive documentation for:
      Project: ${spec.name}
      Description: ${spec.description}
      Architecture: ${JSON.stringify(architecture, null, 2)}
      Features: ${JSON.stringify(features, null, 2)}

      Include:
      1. Project overview
      2. Getting started guide
      3. Architecture documentation
      4. API documentation
      5. Feature descriptions
      6. Configuration guide
      7. Deployment instructions
      8. Troubleshooting
    `;

    const docWorkspace = path.join(this.workspacePath, 'docs', spec.name);
    await fs.ensureDir(docWorkspace);

    await this.executeClaudeCodeTask({
      agent: 'architect',
      action: 'generate-documentation',
      context: {
        spec,
        architecture,
        features,
        workspace: docWorkspace,
        customPrompt: prompt
      }
    });

    // Read the generated README
    const readmePath = path.join(docWorkspace, 'README.md');
    if (await fs.pathExists(readmePath)) {
      return await fs.readFile(readmePath, 'utf-8');
    }

    return 'Documentation generation in progress...';
  }

  /**
   * Clean up workspace
   */
  async cleanupWorkspace(): Promise<void> {
    try {
      await fs.emptyDir(this.workspacePath);
      logger.info('Claude Code SDK workspace cleaned');
    } catch (error) {
      logger.error('Error cleaning workspace:', error);
    }
  }
}

export const claudeCodeSDK = new ClaudeCodeSDKService();