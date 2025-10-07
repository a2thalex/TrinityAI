/**
 * Common GraphQL Type Definitions
 */

import { gql } from 'graphql-tag';

export const commonTypeDefs = gql`
  scalar DateTime
  scalar JSON

  type Query {
    _health: HealthStatus!
  }

  type Mutation {
    _ping: String!
  }

  type Subscription {
    _heartbeat: String!
  }

  type HealthStatus {
    status: String!
    services: [ServiceStatus!]!
    timestamp: DateTime!
  }

  type ServiceStatus {
    name: String!
    status: String!
    latency: Float
    error: String
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  enum SortOrder {
    ASC
    DESC
  }

  interface Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Error {
    message: String!
    code: String
    field: String
  }

  type SuccessResponse {
    success: Boolean!
    message: String
  }

  directive @auth(requires: Role = USER) on FIELD_DEFINITION
  directive @rateLimit(limit: Int = 100, window: String = "1m") on FIELD_DEFINITION
  directive @deprecated(reason: String = "No longer supported") on FIELD_DEFINITION | ENUM_VALUE
  directive @cacheControl(maxAge: Int, scope: CacheControlScope) on FIELD_DEFINITION | OBJECT

  enum Role {
    ADMIN
    USER
    GUEST
  }

  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }
`;