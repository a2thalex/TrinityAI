/**
 * Queue Service for async job processing
 * Uses Bull queue for managing code generation jobs
 */

import Bull, { Queue, Job, QueueOptions } from 'bull';
import { logger } from '../utils/logger';
import { claudeCodeSDK } from './claudeCodeSDK';
import { projectService } from './projectService';
import {
  ProjectSpecification,
  CodeGenerationRequest,
  GeneratedCode,
  ComponentType
} from '../types';

interface CodeGenJobData {
  type: 'generate-app' | 'generate-component' | 'generate-from-description';
  data: ProjectSpecification | CodeGenerationRequest | { description: string };
  metadata?: {
    userId?: string;
    requestId?: string;
    priority?: 'high' | 'normal' | 'low';
  };
}

interface JobResult {
  success: boolean;
  projectId?: string;
  componentId?: string;
  error?: string;
  generatedFiles?: number;
  executionTime?: number;
}

class QueueService {
  private codeGenQueue: Queue<CodeGenJobData> | null = null;
  private deploymentQueue: Queue | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize queues
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queues already initialized');
      return;
    }

    const redisConfig: QueueOptions = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '1') // Use different DB for queues
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    };

    try {
      // Initialize code generation queue
      this.codeGenQueue = new Bull<CodeGenJobData>('code-generation', redisConfig);

      // Initialize deployment queue
      this.deploymentQueue = new Bull('deployment', redisConfig);

      // Register processors
      this.registerProcessors();

      // Register event handlers
      this.registerEventHandlers();

      this.isInitialized = true;
      logger.info('Queue service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize queues:', error);
      throw error;
    }
  }

  /**
   * Register job processors
   */
  private registerProcessors(): void {
    if (!this.codeGenQueue) return;

    // Process code generation jobs
    this.codeGenQueue.process('generate-app', 2, async (job: Job<CodeGenJobData>) => {
      return await this.processGenerateApp(job);
    });

    this.codeGenQueue.process('generate-component', 5, async (job: Job<CodeGenJobData>) => {
      return await this.processGenerateComponent(job);
    });

    this.codeGenQueue.process('generate-from-description', 2, async (job: Job<CodeGenJobData>) => {
      return await this.processGenerateFromDescription(job);
    });

    // Process deployment jobs
    if (this.deploymentQueue) {
      this.deploymentQueue.process('deploy', 3, async (job: Job) => {
        return await this.processDeployment(job);
      });
    }
  }

  /**
   * Register event handlers
   */
  private registerEventHandlers(): void {
    if (!this.codeGenQueue) return;

    // Code generation queue events
    this.codeGenQueue.on('completed', (job: Job, result: JobResult) => {
      logger.info(`Job ${job.id} completed`, {
        type: job.name,
        projectId: result.projectId,
        executionTime: result.executionTime
      });
    });

    this.codeGenQueue.on('failed', (job: Job, err: Error) => {
      logger.error(`Job ${job.id} failed`, {
        type: job.name,
        error: err.message,
        stack: err.stack
      });
    });

    this.codeGenQueue.on('stalled', (job: Job) => {
      logger.warn(`Job ${job.id} stalled`, { type: job.name });
    });

    this.codeGenQueue.on('progress', (job: Job, progress: number) => {
      logger.debug(`Job ${job.id} progress: ${progress}%`, { type: job.name });
    });

    // Global error handler
    this.codeGenQueue.on('error', (error: Error) => {
      logger.error('Queue error:', error);
    });
  }

  /**
   * Process generate app job
   */
  private async processGenerateApp(job: Job<CodeGenJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { data, metadata } = job.data;

    try {
      // Update job progress
      await job.progress(10);

      // Generate application using Claude Code SDK
      logger.info(`Generating application: ${(data as ProjectSpecification).name}`);
      const generatedCode = await claudeCodeSDK.generateApplication(data as ProjectSpecification);

      await job.progress(70);

      // Save project
      const project = await projectService.saveProject(generatedCode, {
        ...metadata,
        generatedAt: new Date().toISOString(),
        jobId: job.id
      });

      await job.progress(90);

      // Store result in Redis for retrieval
      const redisKey = `job:result:${job.id}`;
      await projectService.storeJobResult(redisKey, {
        projectId: project.id,
        projectName: project.name,
        filesGenerated: generatedCode.files.size,
        deployment: generatedCode.deployment
      });

      await job.progress(100);

      return {
        success: true,
        projectId: project.id,
        generatedFiles: generatedCode.files.size,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Failed to generate app: ${error}`);
      throw error;
    }
  }

  /**
   * Process generate component job
   */
  private async processGenerateComponent(job: Job<CodeGenJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { data, metadata } = job.data;

    try {
      await job.progress(10);

      // Generate component using Claude Code SDK
      const request = data as CodeGenerationRequest;
      logger.info(`Generating component: ${request.name}`);
      const generatedCode = await claudeCodeSDK.generateComponent(request);

      await job.progress(70);

      // Save component
      const component = await projectService.saveComponent(generatedCode, {
        ...metadata,
        generatedAt: new Date().toISOString(),
        jobId: job.id
      });

      await job.progress(100);

      return {
        success: true,
        componentId: component.id,
        generatedFiles: generatedCode.files.size,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Failed to generate component: ${error}`);
      throw error;
    }
  }

  /**
   * Process generate from description job
   */
  private async processGenerateFromDescription(job: Job<CodeGenJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { data, metadata } = job.data;

    try {
      await job.progress(5);

      // Parse description to create specification
      const { description } = data as { description: string };
      logger.info(`Generating from description: ${description.substring(0, 100)}...`);

      // Use Claude SDK to parse description into specification
      const spec = await this.parseDescriptionToSpec(description);

      await job.progress(20);

      // Generate application
      const generatedCode = await claudeCodeSDK.generateApplication(spec);

      await job.progress(70);

      // Save project
      const project = await projectService.saveProject(generatedCode, {
        ...metadata,
        description,
        generatedAt: new Date().toISOString(),
        jobId: job.id
      });

      await job.progress(100);

      return {
        success: true,
        projectId: project.id,
        generatedFiles: generatedCode.files.size,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Failed to generate from description: ${error}`);
      throw error;
    }
  }

  /**
   * Process deployment job
   */
  private async processDeployment(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    const { projectId, platform, config } = job.data;

    try {
      await job.progress(10);

      logger.info(`Deploying project ${projectId} to ${platform}`);

      // Deploy using project service
      const deployment = await projectService.deployProject(projectId, {
        platform,
        config
      });

      await job.progress(100);

      return {
        success: true,
        projectId,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Failed to deploy project: ${error}`);
      throw error;
    }
  }

  /**
   * Parse natural language description to project specification
   */
  private async parseDescriptionToSpec(description: string): Promise<ProjectSpecification> {
    // This would use Claude to parse the description
    // For now, return a default spec
    return {
      name: 'generated-app',
      type: 'web-app' as any,
      description,
      framework: 'react' as any,
      language: 'typescript' as any,
      features: [
        {
          name: 'Core Features',
          description: 'Features extracted from: ' + description,
          priority: 'high'
        }
      ],
      database: 'postgresql' as any
    };
  }

  /**
   * Add a code generation job to the queue
   */
  async addCodeGenJob(jobData: CodeGenJobData): Promise<Job<CodeGenJobData>> {
    if (!this.codeGenQueue) {
      throw new Error('Queue service not initialized');
    }

    const priority = jobData.metadata?.priority === 'high' ? 1 :
                    jobData.metadata?.priority === 'low' ? 3 : 2;

    const job = await this.codeGenQueue.add(
      jobData.type,
      jobData,
      {
        priority,
        delay: 0,
        attempts: 3
      }
    );

    logger.info(`Added job ${job.id} to queue`, {
      type: jobData.type,
      priority: jobData.metadata?.priority
    });

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    if (!this.codeGenQueue) {
      throw new Error('Queue service not initialized');
    }

    return await this.codeGenQueue.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id,
      status: state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp
    };
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(grace: number = 3600000): Promise<void> {
    if (!this.codeGenQueue) return;

    const completed = await this.codeGenQueue.clean(grace, 'completed');
    const failed = await this.codeGenQueue.clean(grace, 'failed');

    logger.info(`Cleaned ${completed.length} completed and ${failed.length} failed jobs`);
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<any> {
    if (!this.codeGenQueue) {
      return { status: 'not_initialized' };
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.codeGenQueue.getWaitingCount(),
      this.codeGenQueue.getActiveCount(),
      this.codeGenQueue.getCompletedCount(),
      this.codeGenQueue.getFailedCount(),
      this.codeGenQueue.getDelayedCount(),
      this.codeGenQueue.getPausedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed + paused
    };
  }

  /**
   * Pause queue
   */
  async pauseQueue(): Promise<void> {
    if (this.codeGenQueue) {
      await this.codeGenQueue.pause();
      logger.info('Code generation queue paused');
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(): Promise<void> {
    if (this.codeGenQueue) {
      await this.codeGenQueue.resume();
      logger.info('Code generation queue resumed');
    }
  }

  /**
   * Shutdown queues gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue service...');

    if (this.codeGenQueue) {
      await this.codeGenQueue.close();
    }

    if (this.deploymentQueue) {
      await this.deploymentQueue.close();
    }

    this.isInitialized = false;
    logger.info('Queue service shut down');
  }
}

// Export singleton instance
export const queueService = new QueueService();

// Export initialization function
export async function initializeQueues(): Promise<void> {
  await queueService.initialize();
}

// Export getter function
export function getQueueService(): QueueService {
  if (!queueService) {
    throw new Error('Queue service not initialized');
  }
  return queueService;
}

export default queueService;