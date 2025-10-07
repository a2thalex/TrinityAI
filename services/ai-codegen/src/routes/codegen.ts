import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { claudeCodeSDK } from '../services/claudeCodeSDK';
import { getProjectService } from '../services/projectService';
import { getQueueService } from '../services/queueService';
import { logger } from '../utils/logger';
import {
  ProjectSpecification,
  CodeGenerationRequest,
  ProjectType,
  Framework,
  Language,
  ComponentType
} from '../types';

const router = Router();

// Validation schemas
const ProjectSpecSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ProjectType),
  description: z.string().min(1).max(1000),
  framework: z.nativeEnum(Framework),
  language: z.nativeEnum(Language),
  features: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })),
  database: z.string().optional(),
  authentication: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional()
});

const ComponentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  componentType: z.nativeEnum(ComponentType),
  description: z.string().min(1).max(1000),
  requirements: z.array(z.string()).optional(),
  context: z.object({
    projectType: z.string().optional(),
    framework: z.string().optional(),
    language: z.string().optional(),
    existingCode: z.boolean().optional(),
    dependencies: z.array(z.string()).optional()
  }).optional()
});

/**
 * Generate a complete web application using Claude Code SDK
 */
router.post('/generate-app', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const validatedSpec = ProjectSpecSchema.parse(req.body);

    logger.info(`Generating app with Claude Code SDK: ${validatedSpec.name}`);

    // Use Claude Code SDK directly for immediate generation
    // For large projects, this would be queued
    if (validatedSpec.features.length > 10) {
      // Large project - use queue
      const queueService = getQueueService();
      const job = await queueService.addCodeGenJob({
        type: 'generate-app',
        data: validatedSpec
      });

      return res.status(202).json({
        success: true,
        message: 'Large app generation started (queued)',
        jobId: job.id,
        status: 'queued',
        estimatedTime: '5-10 minutes'
      });
    }

    // Generate the application using Claude Code SDK
    const generatedCode = await claudeCodeSDK.generateApplication(validatedSpec);

    // Save the generated project
    const projectService = getProjectService();
    const project = await projectService.saveProject(generatedCode, {
      type: validatedSpec.type,
      framework: validatedSpec.framework,
      language: validatedSpec.language,
      description: validatedSpec.description
    });

    res.json({
      success: true,
      message: 'App generated successfully with Claude Code SDK',
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        filesCount: project.files.length,
        downloadUrl: `/api/v1/projects/${project.id}/download`
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    next(error);
  }
});

/**
 * Generate a specific component using Claude Code SDK
 */
router.post('/generate-component', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedRequest = ComponentRequestSchema.parse(req.body);

    logger.info(`Generating component with Claude Code SDK: ${validatedRequest.name}`);

    // Use Claude Code SDK to generate the component
    const generatedCode = await claudeCodeSDK.generateComponent(validatedRequest);

    // Store the generated component
    const projectService = getProjectService();
    const component = await projectService.saveComponent(generatedCode);

    res.json({
      success: true,
      message: 'Component generated successfully with Claude Code SDK',
      component: {
        id: component.id,
        name: component.name,
        files: Array.from(generatedCode.files.entries()).map(([path, content]) => ({
          path,
          size: content.length,
          preview: content.substring(0, 200)
        }))
      },
      claudeCodeAgents: ['architect', 'coder', 'tester'] // Show which agents were used
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    next(error);
  }
});

/**
 * Generate code from natural language description
 */
router.post('/generate-from-description', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, type = 'web-app' } = req.body;

    if (!description || description.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Description too short'
      });
    }

    logger.info(`Generating from description: ${description.substring(0, 100)}...`);

    // Parse description to extract requirements
    const claudeService = getClaudeService();

    // First, analyze the description to create a specification
    const analysisPrompt = `
      Analyze this project description and extract:
      1. Project type (web app, API, mobile app, etc.)
      2. Best framework to use
      3. Programming language
      4. Key features
      5. Database requirements
      6. Authentication needs

      Description: ${description}

      Return as JSON with these fields:
      {
        "type": "...",
        "framework": "...",
        "language": "...",
        "features": [...],
        "database": "...",
        "authentication": "..."
      }
    `;

    // This would be sent to Claude for analysis
    // For now, we'll create a basic spec
    const spec: ProjectSpecification = {
      name: `project-${Date.now()}`,
      type: ProjectType.WEB_APP,
      description: description,
      framework: Framework.REACT,
      language: Language.TYPESCRIPT,
      features: [{
        name: 'Core functionality',
        description: description,
        priority: 'high'
      }]
    };

    // Add to queue
    const queueService = getQueueService();
    const job = await queueService.addCodeGenJob({
      type: 'generate-from-description',
      data: { description, spec }
    });

    res.status(202).json({
      success: true,
      message: 'Generation started from description',
      jobId: job.id,
      analyzedSpec: spec
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Generate tests for existing code
 */
router.post('/generate-tests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, framework = 'jest', type = 'unit' } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }

    logger.info(`Generating ${type} tests with ${framework}`);

    const claudeService = getClaudeService();
    const tests = await claudeService.generateTests(code, framework);

    res.json({
      success: true,
      message: 'Tests generated successfully',
      tests,
      framework,
      type
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Generate documentation for code
 */
router.post('/generate-docs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, type = 'technical' } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }

    logger.info(`Generating ${type} documentation`);

    const claudeService = getClaudeService();
    const documentation = await claudeService.generateDocumentation(
      code,
      type as 'api' | 'user' | 'technical'
    );

    res.json({
      success: true,
      message: 'Documentation generated successfully',
      documentation,
      type
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Review and optimize code
 */
router.post('/review-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, context = {} } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }

    logger.info('Reviewing code for optimization');

    const claudeService = getClaudeService();
    const review = await claudeService.reviewCode(code, context);

    res.json({
      success: true,
      message: 'Code review completed',
      review
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Check generation job status
 */
router.get('/job/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const queueService = getQueueService();
    const job = await queueService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get supported frameworks and languages
 */
router.get('/capabilities', (req: Request, res: Response) => {
  res.json({
    projectTypes: Object.values(ProjectType),
    frameworks: Object.values(Framework),
    languages: Object.values(Language),
    componentTypes: Object.values(ComponentType),
    databases: [
      'postgresql', 'mysql', 'mongodb', 'redis',
      'sqlite', 'dynamodb', 'firestore', 'supabase'
    ],
    authTypes: [
      'jwt', 'oauth', 'session', 'api-key',
      'firebase', 'auth0', 'cognito'
    ],
    styling: [
      'tailwind', 'css-modules', 'styled-components',
      'material-ui', 'chakra-ui', 'bootstrap'
    ],
    testing: [
      'jest', 'mocha', 'vitest', 'cypress',
      'playwright', 'pytest', 'junit'
    ],
    deployment: [
      'vercel', 'netlify', 'aws', 'docker',
      'kubernetes', 'heroku', 'cloudflare'
    ]
  });
});

export default router;