/**
 * Prometheus Metrics Middleware
 * Collects and exposes metrics for monitoring the AI Code Generation Service
 */

import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import { logger } from '../utils/logger';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_request_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const codeGenerationDuration = new promClient.Histogram({
  name: 'code_generation_duration_seconds',
  help: 'Duration of code generation operations',
  labelNames: ['type', 'framework', 'language', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600]
});

const codeGenerationTotal = new promClient.Counter({
  name: 'code_generation_total',
  help: 'Total number of code generation operations',
  labelNames: ['type', 'framework', 'language', 'status']
});

const filesGeneratedTotal = new promClient.Counter({
  name: 'files_generated_total',
  help: 'Total number of files generated',
  labelNames: ['type', 'framework']
});

const queueJobsTotal = new promClient.Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status']
});

const queueJobDuration = new promClient.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'type'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const claudeApiCalls = new promClient.Counter({
  name: 'claude_api_calls_total',
  help: 'Total number of Claude API calls',
  labelNames: ['agent', 'action', 'status']
});

const claudeApiDuration = new promClient.Histogram({
  name: 'claude_api_duration_seconds',
  help: 'Duration of Claude API calls',
  labelNames: ['agent', 'action'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60]
});

const tokenUsage = new promClient.Counter({
  name: 'token_usage_total',
  help: 'Total tokens used',
  labelNames: ['type', 'agent']
});

const projectsCreated = new promClient.Counter({
  name: 'projects_created_total',
  help: 'Total number of projects created',
  labelNames: ['type', 'framework', 'database']
});

const deployments = new promClient.Counter({
  name: 'deployments_total',
  help: 'Total number of deployments',
  labelNames: ['platform', 'status']
});

const errorRate = new promClient.Counter({
  name: 'error_rate_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(codeGenerationDuration);
register.registerMetric(codeGenerationTotal);
register.registerMetric(filesGeneratedTotal);
register.registerMetric(queueJobsTotal);
register.registerMetric(queueJobDuration);
register.registerMetric(activeConnections);
register.registerMetric(claudeApiCalls);
register.registerMetric(claudeApiDuration);
register.registerMetric(tokenUsage);
register.registerMetric(projectsCreated);
register.registerMetric(deployments);
register.registerMetric(errorRate);

/**
 * Middleware to track HTTP request metrics
 */
export const prometheusMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Track active connections
  activeConnections.inc();

  // Clean up route path for labels
  const route = req.route?.path || req.path.replace(/\/[a-f0-9-]+/g, '/:id');

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString()
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);

    // Track errors
    if (res.statusCode >= 400) {
      errorRate.inc({
        type: res.statusCode >= 500 ? 'server' : 'client',
        code: res.statusCode.toString()
      });
    }

    // Decrement active connections
    activeConnections.dec();
  });

  next();
};

/**
 * Endpoint to expose metrics
 */
export const metricsEndpoint = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
};

/**
 * Custom metric recorders for specific operations
 */
export const metrics = {
  /**
   * Record code generation metrics
   */
  recordCodeGeneration: (
    type: string,
    framework: string,
    language: string,
    status: 'success' | 'failure',
    duration: number,
    filesCount?: number
  ) => {
    const labels = { type, framework, language, status };
    codeGenerationDuration.observe(labels, duration);
    codeGenerationTotal.inc(labels);

    if (filesCount && status === 'success') {
      filesGeneratedTotal.inc({ type, framework }, filesCount);
    }
  },

  /**
   * Record Claude API call metrics
   */
  recordClaudeApiCall: (
    agent: string,
    action: string,
    status: 'success' | 'failure',
    duration: number,
    tokens?: number
  ) => {
    const labels = { agent, action, status };
    claudeApiCalls.inc(labels);
    claudeApiDuration.observe({ agent, action }, duration);

    if (tokens) {
      tokenUsage.inc({ type: 'claude', agent }, tokens);
    }
  },

  /**
   * Record queue job metrics
   */
  recordQueueJob: (
    queue: string,
    type: string,
    status: 'completed' | 'failed',
    duration: number
  ) => {
    queueJobsTotal.inc({ queue, status });
    queueJobDuration.observe({ queue, type }, duration);
  },

  /**
   * Record project creation
   */
  recordProjectCreated: (
    type: string,
    framework: string,
    database: string
  ) => {
    projectsCreated.inc({ type, framework, database });
  },

  /**
   * Record deployment
   */
  recordDeployment: (
    platform: string,
    status: 'success' | 'failure'
  ) => {
    deployments.inc({ platform, status });
  },

  /**
   * Get current metrics summary
   */
  getSummary: async (): Promise<any> => {
    const metrics = await register.getMetricsAsJSON();
    const summary: any = {};

    for (const metric of metrics) {
      if (metric.type === 'counter') {
        summary[metric.name] = metric.values.reduce((sum: number, v: any) => sum + v.value, 0);
      } else if (metric.type === 'gauge') {
        summary[metric.name] = metric.values[0]?.value || 0;
      } else if (metric.type === 'histogram' && metric.values.length > 0) {
        const sampleCount = metric.values.find((v: any) => v.metricName?.includes('count'));
        const sampleSum = metric.values.find((v: any) => v.metricName?.includes('sum'));

        if (sampleCount && sampleSum) {
          summary[metric.name] = {
            count: sampleCount.value,
            sum: sampleSum.value,
            avg: sampleCount.value > 0 ? sampleSum.value / sampleCount.value : 0
          };
        }
      }
    }

    return summary;
  },

  /**
   * Reset all metrics (useful for testing)
   */
  reset: () => {
    register.resetMetrics();
  }
};

/**
 * Health check endpoint with metrics
 */
export const healthCheckWithMetrics = async (req: Request, res: Response) => {
  try {
    const summary = await metrics.getSummary();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        requests: summary.http_request_total || 0,
        errors: summary.error_rate_total || 0,
        activeConnections: summary.active_connections || 0,
        projectsCreated: summary.projects_created_total || 0,
        codeGenerations: summary.code_generation_total || 0
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Failed to get metrics'
    });
  }
};

export default prometheusMiddleware;