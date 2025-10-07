/**
 * Project Routes
 * Manages generated projects - listing, retrieving, updating, and deleting
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs-extra';
import * as path from 'path';
import archiver from 'archiver';
import { logger } from '../utils/logger';
import { asyncHandler, notFoundError, serverError } from '../middleware/errorHandler';
import { projectService } from '../services/projectService';
import { queueService } from '../services/queueService';
import { redisService } from '../services/redisService';

const router = Router();

// Validation schemas
const ListProjectsSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '10')),
  type: z.string().optional(),
  framework: z.string().optional(),
  language: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'size']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const GitOperationSchema = z.object({
  operation: z.enum(['init', 'commit', 'push', 'pull']),
  message: z.string().optional(),
  branch: z.string().optional(),
  remote: z.string().optional()
});

/**
 * GET /projects - List all projects
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = ListProjectsSchema.parse(req.query);

  // Get projects from Redis
  const projectKeys = await redisService.keys('project:*');
  const projects = await Promise.all(
    projectKeys.map(async key => {
      const project = await redisService.get(key);
      return project;
    })
  );

  // Filter projects
  let filteredProjects = projects.filter(p => p !== null);

  if (query.type) {
    filteredProjects = filteredProjects.filter(p => p.type === query.type);
  }

  if (query.framework) {
    filteredProjects = filteredProjects.filter(p => p.framework === query.framework);
  }

  if (query.language) {
    filteredProjects = filteredProjects.filter(p => p.language === query.language);
  }

  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filteredProjects = filteredProjects.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      p.description?.toLowerCase().includes(searchTerm)
    );
  }

  // Sort projects
  const sortBy = query.sortBy || 'createdAt';
  const order = query.order || 'desc';

  filteredProjects.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Paginate
  const startIndex = (query.page - 1) * query.limit;
  const endIndex = startIndex + query.limit;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  res.json({
    success: true,
    projects: paginatedProjects,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: filteredProjects.length,
      totalPages: Math.ceil(filteredProjects.length / query.limit)
    }
  });
}));

/**
 * GET /projects/:id - Get a specific project
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const project = await projectService.getProject(id);

  if (!project) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    project
  });
}));

/**
 * GET /projects/:id/files - List project files
 */
router.get('/:id/files', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const files = await projectService.getProjectFiles(id);

  if (!files) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    files: Array.from(files.entries()).map(([path, content]) => ({
      path,
      size: Buffer.byteLength(content, 'utf8'),
      type: path.split('.').pop()
    }))
  });
}));

/**
 * GET /projects/:id/files/:filepath - Get a specific file
 */
router.get('/:id/files/*', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const filepath = req.params[0]; // Capture the rest of the path

  const content = await projectService.getProjectFile(id, filepath);

  if (content === null) {
    throw notFoundError('File');
  }

  res.json({
    success: true,
    file: {
      path: filepath,
      content,
      size: Buffer.byteLength(content, 'utf8')
    }
  });
}));

/**
 * PUT /projects/:id - Update project metadata
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = UpdateProjectSchema.parse(req.body);

  const project = await projectService.updateProject(id, updates);

  if (!project) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    project
  });
}));

/**
 * DELETE /projects/:id - Delete a project
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const success = await projectService.deleteProject(id);

  if (!success) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    message: 'Project deleted successfully'
  });
}));

/**
 * POST /projects/:id/duplicate - Duplicate a project
 */
router.post('/:id/duplicate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    throw new Error('New project name is required');
  }

  const duplicatedProject = await projectService.duplicateProject(id, name);

  if (!duplicatedProject) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    project: duplicatedProject
  });
}));

/**
 * GET /projects/:id/download - Download project as ZIP
 */
router.get('/:id/download', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const projectPath = await projectService.getProjectPath(id);

  if (!projectPath || !await fs.pathExists(projectPath)) {
    throw notFoundError('Project');
  }

  const project = await projectService.getProject(id);

  // Set response headers for download
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${project.name}.zip"`
  });

  // Create archive
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  archive.on('error', (err: Error) => {
    logger.error('Archive error:', err);
    throw serverError('Failed to create archive');
  });

  // Pipe archive to response
  archive.pipe(res);

  // Add project files to archive
  archive.directory(projectPath, false);

  // Finalize archive
  await archive.finalize();
}));

/**
 * POST /projects/:id/git - Perform Git operations
 */
router.post('/:id/git', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const operation = GitOperationSchema.parse(req.body);

  const result = await projectService.performGitOperation(id, operation);

  res.json({
    success: true,
    result
  });
}));

/**
 * POST /projects/:id/github - Push to GitHub
 */
router.post('/:id/github', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { repoName, description, isPrivate } = req.body;

  if (!repoName) {
    throw new Error('Repository name is required');
  }

  const repository = await projectService.pushToGitHub(id, repoName, {
    description,
    isPrivate: isPrivate || false
  });

  res.json({
    success: true,
    repository
  });
}));

/**
 * POST /projects/:id/deploy - Deploy project
 */
router.post('/:id/deploy', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { platform, config } = req.body;

  if (!platform) {
    throw new Error('Deployment platform is required');
  }

  // For large projects, use queue
  const project = await projectService.getProject(id);

  if (!project) {
    throw notFoundError('Project');
  }

  // Add to deployment queue
  const job = await queueService.addCodeGenJob({
    type: 'generate-app', // Using same queue for now
    data: { projectId: id, platform, config } as any,
    metadata: {
      priority: 'normal'
    }
  });

  res.status(202).json({
    success: true,
    message: 'Deployment queued',
    jobId: job.id
  });
}));

/**
 * GET /projects/stats - Get projects statistics
 */
router.get('/stats/overview', asyncHandler(async (req: Request, res: Response) => {
  const projectKeys = await redisService.keys('project:*');
  const projects = await Promise.all(
    projectKeys.map(async key => {
      const project = await redisService.get(key);
      return project;
    })
  );

  const stats = {
    total: projects.length,
    byType: {} as Record<string, number>,
    byFramework: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    recentProjects: [] as any[]
  };

  // Calculate statistics
  projects.forEach(project => {
    if (project) {
      // By type
      stats.byType[project.type] = (stats.byType[project.type] || 0) + 1;

      // By framework
      stats.byFramework[project.framework] = (stats.byFramework[project.framework] || 0) + 1;

      // By language
      stats.byLanguage[project.language] = (stats.byLanguage[project.language] || 0) + 1;
    }
  });

  // Get recent projects
  stats.recentProjects = projects
    .filter(p => p !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      framework: p.framework,
      createdAt: p.createdAt
    }));

  res.json({
    success: true,
    stats
  });
}));

/**
 * POST /projects/:id/export - Export project to different formats
 */
router.post('/:id/export', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { format = 'zip', includeNodeModules = false } = req.body;

  const exportPath = await projectService.exportProject(id, {
    format,
    includeNodeModules
  });

  if (!exportPath) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    exportPath,
    format
  });
}));

/**
 * GET /projects/:id/logs - Get project generation logs
 */
router.get('/:id/logs', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Get logs from Redis
  const logs = await redisService.lrange(`project:${id}:logs`, 0, -1);

  res.json({
    success: true,
    logs: logs.map(log => {
      try {
        return JSON.parse(log);
      } catch {
        return log;
      }
    })
  });
}));

/**
 * POST /projects/:id/regenerate - Regenerate specific parts of a project
 */
router.post('/:id/regenerate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { components, features } = req.body;

  if (!components && !features) {
    throw new Error('Specify components or features to regenerate');
  }

  const project = await projectService.getProject(id);

  if (!project) {
    throw notFoundError('Project');
  }

  // Add to queue for regeneration
  const job = await queueService.addCodeGenJob({
    type: 'generate-component',
    data: {
      projectId: id,
      components,
      features,
      regenerate: true
    } as any,
    metadata: {
      priority: 'high'
    }
  });

  res.status(202).json({
    success: true,
    message: 'Regeneration queued',
    jobId: job.id
  });
}));

export default router;