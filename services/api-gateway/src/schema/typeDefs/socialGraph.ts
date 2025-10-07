/**
 * Social Graph Type Definitions
 */

import { gql } from 'graphql-tag';

export const socialGraphTypeDefs = gql`
  extend type Query {
    # User queries
    user(id: ID!): User
    users(filter: UserFilter, pagination: PaginationInput, sort: UserSort): UserConnection!
    searchUsers(query: String!, limit: Int = 10): [User!]!

    # Relationship queries
    relationship(id: ID!): Relationship
    relationships(filter: RelationshipFilter, pagination: PaginationInput): RelationshipConnection!

    # Interaction queries
    interaction(id: ID!): Interaction
    interactions(filter: InteractionFilter, pagination: PaginationInput): InteractionConnection!

    # Graph algorithm queries
    shortestPath(sourceId: ID!, targetId: ID!, maxHops: Int = 6): Path
    userCommunities(userId: ID!, algorithm: CommunityAlgorithm = LOUVAIN): [Community!]!
    influenceScore(userId: ID!): InfluenceMetrics!
    recommendConnections(userId: ID!, limit: Int = 10): [ConnectionRecommendation!]!

    # Graph statistics
    socialGraphStats: SocialGraphStatistics!
  }

  extend type Mutation {
    # User mutations
    createUser(input: CreateUserInput!): User! @rateLimit(limit: 10, window: "1h")
    updateUser(id: ID!, input: UpdateUserInput!): User! @auth
    deleteUser(id: ID!): SuccessResponse! @auth(requires: ADMIN)

    # Relationship mutations
    createRelationship(input: CreateRelationshipInput!): Relationship! @auth
    updateRelationship(id: ID!, input: UpdateRelationshipInput!): Relationship! @auth
    deleteRelationship(id: ID!): SuccessResponse! @auth

    # Interaction mutations
    recordInteraction(input: RecordInteractionInput!): Interaction! @auth

    # Bulk operations
    bulkCreateUsers(users: [CreateUserInput!]!): [User!]! @auth(requires: ADMIN)
    bulkCreateRelationships(relationships: [CreateRelationshipInput!]!): [Relationship!]! @auth(requires: ADMIN)
  }

  extend type Subscription {
    # Real-time updates
    userUpdated(userId: ID!): User!
    relationshipCreated(userId: ID!): Relationship!
    interactionRecorded(userId: ID!): Interaction!
  }

  type User implements Node {
    id: ID!
    username: String!
    email: String
    name: String
    bio: String
    avatarUrl: String
    location: String
    metadata: JSON
    tags: [String!]!

    # Computed fields
    nodeDegree: Int!
    influenceScore: Float!
    communityId: String

    # Relationships
    relationships(type: RelationshipType, direction: RelationshipDirection, pagination: PaginationInput): RelationshipConnection!
    interactions(type: InteractionType, pagination: PaginationInput): InteractionConnection!
    followers(pagination: PaginationInput): UserConnection!
    following(pagination: PaginationInput): UserConnection!

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Relationship implements Node {
    id: ID!
    type: RelationshipType!
    fromUser: User!
    toUser: User!
    weight: Float!
    properties: JSON
    bidirectional: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Interaction implements Node {
    id: ID!
    type: InteractionType!
    fromUser: User!
    toUser: User!
    content: String
    entityId: String
    entityType: String
    metadata: JSON
    timestamp: DateTime!
    processed: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Path {
    nodes: [User!]!
    relationships: [Relationship!]!
    length: Int!
    cost: Float
  }

  type Community {
    id: ID!
    members: [User!]!
    size: Int!
    density: Float!
    modularity: Float
    properties: JSON
  }

  type ConnectionRecommendation {
    user: User!
    score: Float!
    reason: String!
    mutualConnections: [User!]!
    commonInterests: [String!]!
  }

  type InfluenceMetrics {
    userId: ID!
    influenceScore: Float!
    reach: Int!
    engagementRate: Float!
    networkSize: Int!
    clusteringCoefficient: Float!
    betweennessCentrality: Float!
    eigenvectorCentrality: Float!
    pagerank: Float!
  }

  type SocialGraphStatistics {
    totalUsers: Int!
    totalRelationships: Int!
    totalInteractions: Int!
    averageDegree: Float!
    graphDensity: Float!
    componentCount: Int!
    largestComponentSize: Int!
    averageClustering: Float!
  }

  # Enums
  enum RelationshipType {
    FOLLOWS
    FRIEND
    COLLEAGUE
    FAMILY
    BLOCKS
    LIKES
    MENTIONS
    REPORTS_TO
    WORKS_WITH
    KNOWS
  }

  enum InteractionType {
    MESSAGE
    COMMENT
    REACTION
    SHARE
    VIEW
    CLICK
    MENTION
    TAG
    INVITE
    RECOMMEND
  }

  enum RelationshipDirection {
    INCOMING
    OUTGOING
    BOTH
  }

  enum CommunityAlgorithm {
    LOUVAIN
    LABEL_PROPAGATION
    MODULARITY
    INFOMAP
  }

  # Input types
  input CreateUserInput {
    username: String!
    email: String
    name: String
    bio: String
    avatarUrl: String
    location: String
    metadata: JSON
    tags: [String!]
  }

  input UpdateUserInput {
    email: String
    name: String
    bio: String
    avatarUrl: String
    location: String
    metadata: JSON
    tags: [String!]
  }

  input CreateRelationshipInput {
    type: RelationshipType!
    fromUserId: ID!
    toUserId: ID!
    weight: Float
    properties: JSON
    bidirectional: Boolean
  }

  input UpdateRelationshipInput {
    weight: Float
    properties: JSON
  }

  input RecordInteractionInput {
    type: InteractionType!
    fromUserId: ID!
    toUserId: ID!
    content: String
    entityId: String
    entityType: String
    metadata: JSON
  }

  input UserFilter {
    username: String
    email: String
    location: String
    tags: [String!]
    minInfluenceScore: Float
    maxInfluenceScore: Float
  }

  input RelationshipFilter {
    type: RelationshipType
    userId: ID
    minWeight: Float
    maxWeight: Float
  }

  input InteractionFilter {
    type: InteractionType
    userId: ID
    processed: Boolean
    startDate: DateTime
    endDate: DateTime
  }

  input UserSort {
    field: UserSortField!
    order: SortOrder!
  }

  enum UserSortField {
    USERNAME
    CREATED_AT
    UPDATED_AT
    INFLUENCE_SCORE
    NODE_DEGREE
  }

  # Connection types for pagination
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type RelationshipConnection {
    edges: [RelationshipEdge!]!
    pageInfo: PageInfo!
  }

  type RelationshipEdge {
    node: Relationship!
    cursor: String!
  }

  type InteractionConnection {
    edges: [InteractionEdge!]!
    pageInfo: PageInfo!
  }

  type InteractionEdge {
    node: Interaction!
    cursor: String!
  }
`;