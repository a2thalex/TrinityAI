import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { rateLimit } from 'express-rate-limit';
import { register } from 'prom-client';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { prometheusMiddleware } from './middleware/prometheus';
import codegenRouter from './routes/codegen';
import templatesRouter from './routes/templates';
import projectsRouter from './routes/projects';
import deploymentRouter from './routes/deployment';
import { initializeClaudeSDK } from './services/claudeService';
import { initializeQueues } from './services/queueService';
import { connectRedis } from './services/redisService';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8005;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Prometheus metrics
app.use(prometheusMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-codegen-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/codegen', codegenRouter);
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/deployment', deploymentRouter);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.path
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize external services
    await connectRedis();
    await initializeClaudeSDK();
    await initializeQueues();

    server.listen(PORT, () => {
      logger.info(`AI Code Generation Service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API docs: http://localhost:${PORT}/api-docs`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();