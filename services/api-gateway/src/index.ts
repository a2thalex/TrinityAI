/**
 * GraphQL API Gateway
 * Central entry point for all graph operations
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json } from 'body-parser';
import dotenv from 'dotenv';

import { schema } from './schema';
import { createContext } from './context';
import { logger } from './utils/logger';
import { rateLimitDirective } from './directives/rateLimit';
import { authDirective } from './directives/auth';
import { depthLimit } from './middleware/depthLimit';
import { complexityLimit } from './middleware/complexity';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;

async function startServer() {
  // Create Express app
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // GraphQL playground needs this disabled
  }));
  app.use(compression());
  app.use(cors());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'api-gateway' });
  });

  // Create HTTP server
  const httpServer = http.createServer(app);

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          logger.info('GraphQL Server starting...');
        },
        async requestDidStart() {
          return {
            async willSendResponse(requestContext) {
              // Log query performance
              const { request, response } = requestContext;
              logger.info('Query executed', {
                query: request.query,
                variables: request.variables,
                duration: response.http?.body.extensions?.duration,
              });
            },
            async didEncounterErrors(requestContext) {
              // Log errors
              const { errors } = requestContext;
              errors?.forEach(error => {
                logger.error('GraphQL Error', {
                  message: error.message,
                  path: error.path,
                  extensions: error.extensions,
                });
              });
            },
          };
        },
      },
    ],
    validationRules: [
      depthLimit(10), // Limit query depth
      complexityLimit(1000), // Limit query complexity
    ],
  });

  // Start Apollo Server
  await server.start();

  // Apply GraphQL middleware
  app.use(
    '/graphql',
    json(),
    expressMiddleware(server, {
      context: createContext,
    })
  );

  // Start HTTP server
  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));

  logger.info(`🚀 GraphQL Server ready at http://localhost:${PORT}/graphql`);
  logger.info(`📊 GraphQL Playground available at http://localhost:${PORT}/graphql`);
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});