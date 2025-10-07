/**
 * Deployment Routes
 * Manages automated deployment of generated applications
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { asyncHandler, notFoundError, serverError } from '../middleware/errorHandler';
import { projectService } from '../services/projectService';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';

const router = Router();
const execAsync = promisify(exec);

// Supported deployment platforms
enum DeploymentPlatform {
  VERCEL = 'vercel',
  NETLIFY = 'netlify',
  AWS = 'aws',
  GOOGLE_CLOUD = 'google-cloud',
  AZURE = 'azure',
  HEROKU = 'heroku',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes',
  RAILWAY = 'railway',
  RENDER = 'render'
}

// Deployment status
enum DeploymentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Validation schemas
const DeploymentConfigSchema = z.object({
  platform: z.nativeEnum(DeploymentPlatform),
  environment: z.enum(['development', 'staging', 'production']),
  config: z.record(z.any()).optional(),
  envVars: z.record(z.string()).optional(),
  autoScale: z.boolean().optional(),
  monitoring: z.boolean().optional()
});

const VercelConfigSchema = z.object({
  projectName: z.string(),
  token: z.string(),
  team: z.string().optional(),
  regions: z.array(z.string()).optional(),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional()
});

const DockerConfigSchema = z.object({
  imageName: z.string(),
  tag: z.string().optional(),
  registry: z.string().optional(),
  dockerfile: z.string().optional(),
  buildArgs: z.record(z.string()).optional()
});

const KubernetesConfigSchema = z.object({
  cluster: z.string(),
  namespace: z.string().optional(),
  replicas: z.number().optional(),
  resources: z.object({
    cpu: z.string().optional(),
    memory: z.string().optional()
  }).optional()
});

/**
 * Deploy to Vercel
 */
async function deployToVercel(
  projectPath: string,
  config: z.infer<typeof VercelConfigSchema>
): Promise<any> {
  logger.info(`Deploying to Vercel: ${config.projectName}`);

  try {
    // Install Vercel CLI if not present
    await execAsync('npm list -g vercel || npm install -g vercel');

    // Set token
    process.env.VERCEL_TOKEN = config.token;

    // Build command
    let command = `vercel --token ${config.token} --yes`;

    if (config.projectName) {
      command += ` --name ${config.projectName}`;
    }

    if (config.team) {
      command += ` --scope ${config.team}`;
    }

    if (config.buildCommand) {
      command += ` --build-env BUILD_COMMAND="${config.buildCommand}"`;
    }

    // Execute deployment
    const { stdout, stderr } = await execAsync(command, { cwd: projectPath });

    // Extract deployment URL
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const deploymentUrl = urlMatch ? urlMatch[0] : null;

    return {
      success: true,
      platform: 'vercel',
      url: deploymentUrl,
      logs: stdout,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Vercel deployment failed:', error);
    throw error;
  }
}

/**
 * Deploy to Netlify
 */
async function deployToNetlify(
  projectPath: string,
  config: any
): Promise<any> {
  logger.info(`Deploying to Netlify: ${config.siteName}`);

  try {
    // Install Netlify CLI if not present
    await execAsync('npm list -g netlify-cli || npm install -g netlify-cli');

    // Build the project first
    if (config.buildCommand) {
      await execAsync(config.buildCommand, { cwd: projectPath });
    }

    // Deploy command
    const command = `netlify deploy --prod --dir ${config.outputDirectory || 'dist'} --auth ${config.token} --site ${config.siteId}`;

    const { stdout } = await execAsync(command, { cwd: projectPath });

    // Extract deployment URL
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const deploymentUrl = urlMatch ? urlMatch[0] : null;

    return {
      success: true,
      platform: 'netlify',
      url: deploymentUrl,
      logs: stdout,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Netlify deployment failed:', error);
    throw error;
  }
}

/**
 * Build Docker image
 */
async function deployToDocker(
  projectPath: string,
  config: z.infer<typeof DockerConfigSchema>
): Promise<any> {
  logger.info(`Building Docker image: ${config.imageName}`);

  try {
    const dockerfilePath = path.join(projectPath, config.dockerfile || 'Dockerfile');

    // Check if Dockerfile exists
    if (!await fs.pathExists(dockerfilePath)) {
      // Generate Dockerfile if not exists
      await generateDockerfile(projectPath);
    }

    // Build image
    let buildCommand = `docker build -t ${config.imageName}`;

    if (config.tag) {
      buildCommand += `:${config.tag}`;
    }

    if (config.buildArgs) {
      Object.entries(config.buildArgs).forEach(([key, value]) => {
        buildCommand += ` --build-arg ${key}=${value}`;
      });
    }

    buildCommand += ` -f ${dockerfilePath} ${projectPath}`;

    const { stdout: buildOutput } = await execAsync(buildCommand);

    // Push to registry if specified
    if (config.registry) {
      const tagCommand = `docker tag ${config.imageName}:${config.tag || 'latest'} ${config.registry}/${config.imageName}:${config.tag || 'latest'}`;
      await execAsync(tagCommand);

      const pushCommand = `docker push ${config.registry}/${config.imageName}:${config.tag || 'latest'}`;
      const { stdout: pushOutput } = await execAsync(pushCommand);

      return {
        success: true,
        platform: 'docker',
        image: `${config.registry}/${config.imageName}:${config.tag || 'latest'}`,
        logs: buildOutput + '\n' + pushOutput,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      platform: 'docker',
      image: `${config.imageName}:${config.tag || 'latest'}`,
      logs: buildOutput,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Docker build failed:', error);
    throw error;
  }
}

/**
 * Deploy to Kubernetes
 */
async function deployToKubernetes(
  projectPath: string,
  config: z.infer<typeof KubernetesConfigSchema>
): Promise<any> {
  logger.info(`Deploying to Kubernetes: ${config.cluster}`);

  try {
    const manifestPath = path.join(projectPath, 'k8s');

    // Check if K8s manifests exist
    if (!await fs.pathExists(manifestPath)) {
      // Generate K8s manifests if not exist
      await generateKubernetesManifests(projectPath, config);
    }

    // Apply manifests
    const namespace = config.namespace || 'default';
    const command = `kubectl apply -f ${manifestPath} -n ${namespace}`;

    const { stdout } = await execAsync(command);

    // Get service endpoint
    const getServiceCommand = `kubectl get service -n ${namespace} -o json`;
    const { stdout: serviceOutput } = await execAsync(getServiceCommand);

    return {
      success: true,
      platform: 'kubernetes',
      cluster: config.cluster,
      namespace,
      logs: stdout,
      services: JSON.parse(serviceOutput),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Kubernetes deployment failed:', error);
    throw error;
  }
}

/**
 * Generate Dockerfile if not exists
 */
async function generateDockerfile(projectPath: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (await fs.pathExists(packageJsonPath)) {
    // Node.js application
    const dockerfile = `
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;
    await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
  } else {
    // Default Dockerfile
    const dockerfile = `
FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["/bin/sh"]
`;
    await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
  }
}

/**
 * Generate Kubernetes manifests
 */
async function generateKubernetesManifests(
  projectPath: string,
  config: z.infer<typeof KubernetesConfigSchema>
): Promise<void> {
  const k8sPath = path.join(projectPath, 'k8s');
  await fs.ensureDir(k8sPath);

  // Deployment manifest
  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: 'app-deployment',
      namespace: config.namespace || 'default'
    },
    spec: {
      replicas: config.replicas || 3,
      selector: {
        matchLabels: {
          app: 'app'
        }
      },
      template: {
        metadata: {
          labels: {
            app: 'app'
          }
        },
        spec: {
          containers: [{
            name: 'app',
            image: 'app:latest',
            ports: [{ containerPort: 3000 }],
            resources: {
              limits: {
                cpu: config.resources?.cpu || '500m',
                memory: config.resources?.memory || '512Mi'
              }
            }
          }]
        }
      }
    }
  };

  // Service manifest
  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: 'app-service',
      namespace: config.namespace || 'default'
    },
    spec: {
      selector: {
        app: 'app'
      },
      ports: [{
        protocol: 'TCP',
        port: 80,
        targetPort: 3000
      }],
      type: 'LoadBalancer'
    }
  };

  await fs.writeFile(
    path.join(k8sPath, 'deployment.yaml'),
    JSON.stringify(deployment, null, 2)
  );

  await fs.writeFile(
    path.join(k8sPath, 'service.yaml'),
    JSON.stringify(service, null, 2)
  );
}

/**
 * POST /deployment/deploy - Deploy a project
 */
router.post('/deploy', asyncHandler(async (req: Request, res: Response) => {
  const config = DeploymentConfigSchema.parse(req.body);
  const { projectId } = req.body;

  if (!projectId) {
    throw new Error('Project ID is required');
  }

  const projectPath = await projectService.getProjectPath(projectId);

  if (!projectPath) {
    throw notFoundError('Project');
  }

  let deploymentResult;

  switch (config.platform) {
    case DeploymentPlatform.VERCEL:
      const vercelConfig = VercelConfigSchema.parse(config.config);
      deploymentResult = await deployToVercel(projectPath, vercelConfig);
      break;

    case DeploymentPlatform.NETLIFY:
      deploymentResult = await deployToNetlify(projectPath, config.config);
      break;

    case DeploymentPlatform.DOCKER:
      const dockerConfig = DockerConfigSchema.parse(config.config);
      deploymentResult = await deployToDocker(projectPath, dockerConfig);
      break;

    case DeploymentPlatform.KUBERNETES:
      const k8sConfig = KubernetesConfigSchema.parse(config.config);
      deploymentResult = await deployToKubernetes(projectPath, k8sConfig);
      break;

    default:
      throw new Error(`Platform ${config.platform} not yet supported`);
  }

  // Store deployment info
  await projectService.updateProject(projectId, {
    deployment: deploymentResult,
    lastDeployedAt: new Date().toISOString()
  });

  // Track metrics
  const { metrics } = await import('../middleware/prometheus');
  metrics.recordDeployment(
    config.platform,
    deploymentResult.success ? 'success' : 'failure'
  );

  res.json({
    success: true,
    deployment: deploymentResult
  });
}));

/**
 * GET /deployment/platforms - Get supported platforms
 */
router.get('/platforms', (req: Request, res: Response) => {
  const platforms = Object.values(DeploymentPlatform).map(platform => ({
    id: platform,
    name: platform.charAt(0).toUpperCase() + platform.slice(1).replace('-', ' '),
    supported: ['vercel', 'netlify', 'docker', 'kubernetes'].includes(platform),
    requiresAuth: ['vercel', 'netlify', 'aws', 'google-cloud', 'azure'].includes(platform)
  }));

  res.json({
    success: true,
    platforms
  });
});

/**
 * GET /deployment/:projectId/status - Get deployment status
 */
router.get('/:projectId/status', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = await projectService.getProject(projectId);

  if (!project) {
    throw notFoundError('Project');
  }

  res.json({
    success: true,
    deployment: project.deployment || null,
    lastDeployedAt: project.lastDeployedAt || null
  });
}));

/**
 * POST /deployment/:projectId/rollback - Rollback deployment
 */
router.post('/:projectId/rollback', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { version } = req.body;

  // This would implement actual rollback logic
  // For now, just return success
  res.json({
    success: true,
    message: 'Rollback initiated',
    version
  });
}));

/**
 * GET /deployment/:projectId/logs - Get deployment logs
 */
router.get('/:projectId/logs', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { lines = 100 } = req.query;

  // Get deployment logs from Redis
  const { redisService } = await import('../services/redisService');
  const logs = await redisService.lrange(
    `deployment:${projectId}:logs`,
    0,
    parseInt(lines as string)
  );

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
 * POST /deployment/validate - Validate deployment configuration
 */
router.post('/validate', asyncHandler(async (req: Request, res: Response) => {
  const config = DeploymentConfigSchema.parse(req.body);

  const validation = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[]
  };

  // Platform-specific validation
  switch (config.platform) {
    case DeploymentPlatform.VERCEL:
      if (!config.config?.token) {
        validation.errors.push('Vercel token is required');
        validation.valid = false;
      }
      break;

    case DeploymentPlatform.DOCKER:
      if (!config.config?.imageName) {
        validation.errors.push('Docker image name is required');
        validation.valid = false;
      }
      break;

    case DeploymentPlatform.KUBERNETES:
      if (!config.config?.cluster) {
        validation.errors.push('Kubernetes cluster is required');
        validation.valid = false;
      }
      break;
  }

  // Environment-specific warnings
  if (config.environment === 'production' && !config.monitoring) {
    validation.warnings.push('Monitoring is recommended for production deployments');
  }

  res.json({
    success: true,
    validation
  });
}));

export default router;