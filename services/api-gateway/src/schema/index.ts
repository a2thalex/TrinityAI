/**
 * GraphQL Schema Definition
 * Unified schema for the AI Awareness System
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

// Type definitions
import { socialGraphTypeDefs } from './typeDefs/socialGraph';
import { knowledgeGraphTypeDefs } from './typeDefs/knowledgeGraph';
import { aiGraphTypeDefs } from './typeDefs/aiGraph';
import { fusionTypeDefs } from './typeDefs/fusion';
import { commonTypeDefs } from './typeDefs/common';

// Resolvers
import { socialGraphResolvers } from './resolvers/socialGraph';
import { knowledgeGraphResolvers } from './resolvers/knowledgeGraph';
import { aiGraphResolvers } from './resolvers/aiGraph';
import { fusionResolvers } from './resolvers/fusion';

// Merge all type definitions
const typeDefs = mergeTypeDefs([
  commonTypeDefs,
  socialGraphTypeDefs,
  knowledgeGraphTypeDefs,
  aiGraphTypeDefs,
  fusionTypeDefs,
]);

// Merge all resolvers
const resolvers = mergeResolvers([
  socialGraphResolvers,
  knowledgeGraphResolvers,
  aiGraphResolvers,
  fusionResolvers,
]);

// Create executable schema
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});