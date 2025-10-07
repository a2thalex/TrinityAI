/**
 * Template Routes
 * Manages pre-built application templates for quick project generation
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../utils/logger';
import { asyncHandler, validationError, notFoundError } from '../middleware/errorHandler';
import { claudeCodeSDK } from '../services/claudeCodeSDK';
import {
  ProjectType,
  Framework,
  Language,
  Database,
  AuthType,
  ProjectSpecification
} from '../types';

const router = Router();

// Template interface
interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  type: ProjectType;
  framework: Framework;
  language: Language;
  features: string[];
  database?: Database;
  authentication?: AuthType;
  thumbnail?: string;
  popularity: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[];
}

// Pre-defined templates
const templates: Template[] = [
  {
    id: 'ecommerce-react',
    name: 'E-Commerce Platform',
    description: 'Full-featured e-commerce platform with product catalog, cart, checkout, and admin panel',
    category: 'E-Commerce',
    type: ProjectType.WEB_APP,
    framework: Framework.NEXT,
    language: Language.TYPESCRIPT,
    features: [
      'Product catalog with search and filters',
      'Shopping cart and checkout',
      'User authentication and profiles',
      'Payment integration (Stripe)',
      'Admin dashboard',
      'Order management',
      'Email notifications',
      'Product reviews and ratings'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 95,
    difficulty: 'advanced',
    estimatedTime: '5-10 minutes',
    tags: ['shopping', 'payments', 'admin', 'full-stack']
  },
  {
    id: 'social-media-app',
    name: 'Social Media Platform',
    description: 'Social networking app with posts, comments, likes, and real-time chat',
    category: 'Social',
    type: ProjectType.WEB_APP,
    framework: Framework.REACT,
    language: Language.TYPESCRIPT,
    features: [
      'User profiles and authentication',
      'Post creation with images',
      'Comments and likes',
      'Follow/unfollow system',
      'Real-time chat',
      'Notifications',
      'Search users and posts',
      'Trending topics'
    ],
    database: Database.MONGODB,
    authentication: AuthType.OAUTH,
    popularity: 90,
    difficulty: 'advanced',
    estimatedTime: '5-10 minutes',
    tags: ['social', 'chat', 'real-time', 'media']
  },
  {
    id: 'task-management',
    name: 'Task Management System',
    description: 'Trello-like task management with boards, lists, and drag-and-drop',
    category: 'Productivity',
    type: ProjectType.WEB_APP,
    framework: Framework.VUE,
    language: Language.TYPESCRIPT,
    features: [
      'Boards and lists',
      'Drag and drop cards',
      'User collaboration',
      'Due dates and reminders',
      'Labels and categories',
      'File attachments',
      'Activity tracking',
      'Search and filters'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 85,
    difficulty: 'intermediate',
    estimatedTime: '3-5 minutes',
    tags: ['productivity', 'kanban', 'collaboration', 'project-management']
  },
  {
    id: 'blog-platform',
    name: 'Blog Platform',
    description: 'Medium-like blogging platform with markdown editor and comments',
    category: 'Content',
    type: ProjectType.WEB_APP,
    framework: Framework.NEXT,
    language: Language.TYPESCRIPT,
    features: [
      'Markdown editor',
      'Article publishing',
      'Comments system',
      'User profiles',
      'Categories and tags',
      'Search functionality',
      'RSS feed',
      'SEO optimization'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 80,
    difficulty: 'intermediate',
    estimatedTime: '3-5 minutes',
    tags: ['blog', 'content', 'markdown', 'cms']
  },
  {
    id: 'dashboard-analytics',
    name: 'Analytics Dashboard',
    description: 'Data visualization dashboard with charts, metrics, and real-time updates',
    category: 'Analytics',
    type: ProjectType.WEB_APP,
    framework: Framework.REACT,
    language: Language.TYPESCRIPT,
    features: [
      'Interactive charts',
      'Real-time metrics',
      'Custom date ranges',
      'Data export',
      'Multiple data sources',
      'Custom dashboards',
      'Alerts and thresholds',
      'Mobile responsive'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 75,
    difficulty: 'intermediate',
    estimatedTime: '3-5 minutes',
    tags: ['analytics', 'charts', 'metrics', 'visualization']
  },
  {
    id: 'chat-application',
    name: 'Real-time Chat App',
    description: 'WhatsApp-like chat application with groups and file sharing',
    category: 'Communication',
    type: ProjectType.WEB_APP,
    framework: Framework.REACT,
    language: Language.TYPESCRIPT,
    features: [
      'Real-time messaging',
      'Group chats',
      'File sharing',
      'Voice messages',
      'Read receipts',
      'Online status',
      'Message search',
      'Emoji reactions'
    ],
    database: Database.MONGODB,
    authentication: AuthType.JWT,
    popularity: 88,
    difficulty: 'advanced',
    estimatedTime: '5-10 minutes',
    tags: ['chat', 'real-time', 'websocket', 'communication']
  },
  {
    id: 'fitness-tracker',
    name: 'Fitness Tracker',
    description: 'Health and fitness tracking app with workouts and progress monitoring',
    category: 'Health',
    type: ProjectType.MOBILE_APP,
    framework: Framework.REACT_NATIVE,
    language: Language.TYPESCRIPT,
    features: [
      'Workout tracking',
      'Progress charts',
      'Goal setting',
      'Meal planning',
      'Water intake',
      'Sleep tracking',
      'Social features',
      'Achievements'
    ],
    database: Database.MONGODB,
    authentication: AuthType.JWT,
    popularity: 70,
    difficulty: 'intermediate',
    estimatedTime: '5-10 minutes',
    tags: ['health', 'fitness', 'mobile', 'tracking']
  },
  {
    id: 'restaurant-pos',
    name: 'Restaurant POS System',
    description: 'Point of sale system for restaurants with order management',
    category: 'Business',
    type: ProjectType.WEB_APP,
    framework: Framework.VUE,
    language: Language.TYPESCRIPT,
    features: [
      'Menu management',
      'Order taking',
      'Table management',
      'Payment processing',
      'Kitchen display',
      'Inventory tracking',
      'Staff management',
      'Sales reports'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 65,
    difficulty: 'advanced',
    estimatedTime: '5-10 minutes',
    tags: ['pos', 'restaurant', 'business', 'payments']
  },
  {
    id: 'learning-platform',
    name: 'Online Learning Platform',
    description: 'Educational platform with courses, quizzes, and progress tracking',
    category: 'Education',
    type: ProjectType.WEB_APP,
    framework: Framework.NEXT,
    language: Language.TYPESCRIPT,
    features: [
      'Course creation',
      'Video lessons',
      'Quizzes and tests',
      'Progress tracking',
      'Certificates',
      'Discussion forums',
      'Live classes',
      'Payment integration'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 82,
    difficulty: 'advanced',
    estimatedTime: '5-10 minutes',
    tags: ['education', 'e-learning', 'courses', 'video']
  },
  {
    id: 'api-microservice',
    name: 'RESTful API Service',
    description: 'Production-ready REST API with authentication and rate limiting',
    category: 'Backend',
    type: ProjectType.API,
    framework: Framework.EXPRESS,
    language: Language.TYPESCRIPT,
    features: [
      'RESTful endpoints',
      'JWT authentication',
      'Rate limiting',
      'Input validation',
      'Error handling',
      'API documentation',
      'Database integration',
      'Testing suite'
    ],
    database: Database.POSTGRESQL,
    authentication: AuthType.JWT,
    popularity: 90,
    difficulty: 'intermediate',
    estimatedTime: '2-3 minutes',
    tags: ['api', 'backend', 'rest', 'microservice']
  }
];

// Validation schemas
const GetTemplatesSchema = z.object({
  category: z.string().optional(),
  type: z.nativeEnum(ProjectType).optional(),
  framework: z.nativeEnum(Framework).optional(),
  language: z.nativeEnum(Language).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  search: z.string().optional()
});

const GenerateFromTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string().min(1).max(100),
  customizations: z.object({
    features: z.array(z.string()).optional(),
    database: z.nativeEnum(Database).optional(),
    authentication: z.nativeEnum(AuthType).optional(),
    additionalPackages: z.array(z.string()).optional()
  }).optional()
});

/**
 * GET /templates - Get all available templates
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = GetTemplatesSchema.parse(req.query);

  let filteredTemplates = [...templates];

  // Apply filters
  if (query.category) {
    filteredTemplates = filteredTemplates.filter(t =>
      t.category.toLowerCase() === query.category!.toLowerCase()
    );
  }

  if (query.type) {
    filteredTemplates = filteredTemplates.filter(t => t.type === query.type);
  }

  if (query.framework) {
    filteredTemplates = filteredTemplates.filter(t => t.framework === query.framework);
  }

  if (query.language) {
    filteredTemplates = filteredTemplates.filter(t => t.language === query.language);
  }

  if (query.difficulty) {
    filteredTemplates = filteredTemplates.filter(t => t.difficulty === query.difficulty);
  }

  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filteredTemplates = filteredTemplates.filter(t =>
      t.name.toLowerCase().includes(searchTerm) ||
      t.description.toLowerCase().includes(searchTerm) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // Sort by popularity
  filteredTemplates.sort((a, b) => b.popularity - a.popularity);

  res.json({
    success: true,
    templates: filteredTemplates,
    total: filteredTemplates.length
  });
}));

/**
 * GET /templates/categories - Get all template categories
 */
router.get('/categories', (req: Request, res: Response) => {
  const categories = [...new Set(templates.map(t => t.category))];

  const categoriesWithCount = categories.map(category => ({
    name: category,
    count: templates.filter(t => t.category === category).length
  }));

  res.json({
    success: true,
    categories: categoriesWithCount
  });
});

/**
 * GET /templates/:id - Get a specific template
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const template = templates.find(t => t.id === id);

  if (!template) {
    throw notFoundError('Template');
  }

  res.json({
    success: true,
    template
  });
}));

/**
 * POST /templates/:id/generate - Generate project from template
 */
router.post('/:id/generate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = GenerateFromTemplateSchema.parse(req.body);

  const template = templates.find(t => t.id === id);

  if (!template) {
    throw notFoundError('Template');
  }

  logger.info(`Generating project from template: ${template.name}`);

  // Create project specification from template
  const spec: ProjectSpecification = {
    name: body.name,
    type: template.type,
    description: `Generated from ${template.name} template: ${template.description}`,
    framework: template.framework,
    language: template.language,
    features: template.features.map(f => ({
      name: f,
      description: f,
      priority: 'high'
    })),
    database: body.customizations?.database || template.database,
    authentication: body.customizations?.authentication || template.authentication
  };

  // Add custom features if provided
  if (body.customizations?.features) {
    spec.features.push(...body.customizations.features.map(f => ({
      name: f,
      description: f,
      priority: 'medium'
    })));
  }

  // Generate using Claude Code SDK
  const startTime = Date.now();
  const generatedCode = await claudeCodeSDK.generateApplication(spec);
  const executionTime = Date.now() - startTime;

  // Track metrics
  const { metrics } = await import('../middleware/prometheus');
  metrics.recordCodeGeneration(
    template.type,
    template.framework,
    template.language,
    'success',
    executionTime / 1000,
    generatedCode.files.size
  );

  // Save project
  const { projectService } = await import('../services/projectService');
  const project = await projectService.saveProject(generatedCode, {
    templateId: template.id,
    templateName: template.name,
    customizations: body.customizations,
    generatedAt: new Date().toISOString()
  });

  res.json({
    success: true,
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      framework: project.framework,
      filesGenerated: generatedCode.files.size,
      executionTime
    }
  });
}));

/**
 * GET /templates/:id/preview - Get template preview (sample files)
 */
router.get('/:id/preview', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const template = templates.find(t => t.id === id);

  if (!template) {
    throw notFoundError('Template');
  }

  // Generate preview files (structure only, not full implementation)
  const preview = {
    structure: {
      'src/': {
        'components/': ['Header.tsx', 'Footer.tsx', 'Layout.tsx'],
        'pages/': ['index.tsx', 'about.tsx'],
        'services/': ['api.ts', 'auth.ts'],
        'utils/': ['helpers.ts', 'constants.ts']
      },
      'public/': ['favicon.ico', 'logo.svg'],
      'tests/': ['app.test.ts', 'components.test.ts'],
      'package.json': 'file',
      'README.md': 'file',
      'tsconfig.json': 'file',
      '.env.example': 'file'
    },
    dependencies: [
      'react',
      'react-dom',
      'next',
      'typescript',
      'tailwindcss',
      'axios',
      'zod'
    ],
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      test: 'jest',
      lint: 'eslint .'
    }
  };

  res.json({
    success: true,
    template: {
      id: template.id,
      name: template.name
    },
    preview
  });
}));

/**
 * POST /templates/suggest - Get template suggestions based on description
 */
router.post('/suggest', asyncHandler(async (req: Request, res: Response) => {
  const { description } = req.body;

  if (!description || typeof description !== 'string') {
    throw validationError('Description is required');
  }

  // Simple keyword matching for suggestions
  const keywords = description.toLowerCase().split(' ');

  const scores = templates.map(template => {
    let score = 0;

    // Check name and description
    keywords.forEach(keyword => {
      if (template.name.toLowerCase().includes(keyword)) score += 3;
      if (template.description.toLowerCase().includes(keyword)) score += 2;
      if (template.tags.some(tag => tag.toLowerCase().includes(keyword))) score += 1;
    });

    return { template, score };
  });

  // Get top 5 suggestions
  const suggestions = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.template);

  res.json({
    success: true,
    suggestions
  });
}));

export default router;