"""
Data models for Social Graph Service
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RelationshipType(str, Enum):
    """Types of relationships in the social graph"""
    FOLLOWS = "FOLLOWS"
    FRIEND = "FRIEND"
    COLLEAGUE = "COLLEAGUE"
    FAMILY = "FAMILY"
    BLOCKS = "BLOCKS"
    LIKES = "LIKES"
    MENTIONS = "MENTIONS"
    REPORTS_TO = "REPORTS_TO"
    WORKS_WITH = "WORKS_WITH"
    KNOWS = "KNOWS"


class InteractionType(str, Enum):
    """Types of interactions between users"""
    MESSAGE = "MESSAGE"
    COMMENT = "COMMENT"
    REACTION = "REACTION"
    SHARE = "SHARE"
    VIEW = "VIEW"
    CLICK = "CLICK"
    MENTION = "MENTION"
    TAG = "TAG"
    INVITE = "INVITE"
    RECOMMEND = "RECOMMEND"


class UserBase(BaseModel):
    """Base user model"""
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    location: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class UserCreate(UserBase):
    """Model for creating a user"""
    tags: Optional[List[str]] = []
    properties: Optional[Dict[str, Any]] = {}


class User(UserBase):
    """Complete user model"""
    id: str
    created_at: datetime
    updated_at: datetime
    node_degree: Optional[int] = 0
    influence_score: Optional[float] = 0.0
    community_id: Optional[str] = None
    tags: List[str] = []
    properties: Dict[str, Any] = {}

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RelationshipBase(BaseModel):
    """Base relationship model"""
    type: RelationshipType
    properties: Optional[Dict[str, Any]] = {}
    weight: Optional[float] = 1.0


class RelationshipCreate(RelationshipBase):
    """Model for creating a relationship"""
    from_user_id: str
    to_user_id: str
    bidirectional: bool = False


class Relationship(RelationshipBase):
    """Complete relationship model"""
    id: str
    from_user: User
    to_user: User
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class InteractionBase(BaseModel):
    """Base interaction model"""
    type: InteractionType
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class InteractionCreate(InteractionBase):
    """Model for creating an interaction"""
    from_user_id: str
    to_user_id: str
    entity_id: Optional[str] = None  # ID of the entity being interacted with
    entity_type: Optional[str] = None  # Type of entity (post, comment, etc.)


class Interaction(InteractionBase):
    """Complete interaction model"""
    id: str
    from_user_id: str
    to_user_id: str
    entity_id: Optional[str] = None
    entity_type: Optional[str] = None
    timestamp: datetime
    processed: bool = False

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class GraphQuery(BaseModel):
    """Model for graph queries"""
    cypher: str = Field(..., description="Cypher query to execute")
    parameters: Optional[Dict[str, Any]] = {}
    limit: Optional[int] = 100
    skip: Optional[int] = 0


class GraphResponse(BaseModel):
    """Model for graph query responses"""
    data: Any
    metadata: Optional[Dict[str, Any]] = {}
    execution_time: Optional[float] = None
    node_count: Optional[int] = None
    relationship_count: Optional[int] = None


class PathResult(BaseModel):
    """Model for path query results"""
    path: List[Dict[str, Any]]
    length: int
    cost: Optional[float] = None
    nodes: List[User]
    relationships: List[Dict[str, Any]]


class CommunityResult(BaseModel):
    """Model for community detection results"""
    community_id: str
    members: List[User]
    size: int
    density: float
    modularity: Optional[float] = None
    properties: Dict[str, Any] = {}


class RecommendationResult(BaseModel):
    """Model for recommendation results"""
    user: User
    score: float
    reason: str
    mutual_connections: List[User] = []
    common_interests: List[str] = []
    properties: Dict[str, Any] = {}


class InfluenceMetrics(BaseModel):
    """Model for influence metrics"""
    user_id: str
    influence_score: float
    reach: int
    engagement_rate: float
    network_size: int
    clustering_coefficient: float
    betweenness_centrality: float
    eigenvector_centrality: float
    pagerank: float


class GraphStatistics(BaseModel):
    """Model for graph statistics"""
    total_nodes: int
    total_relationships: int
    node_types: Dict[str, int]
    relationship_types: Dict[str, int]
    average_degree: float
    graph_density: float
    component_count: int
    largest_component_size: int
    average_clustering: float
    average_path_length: Optional[float] = None


class BulkOperation(BaseModel):
    """Model for bulk operations"""
    operation: str = Field(..., description="Type of bulk operation")
    entities: List[Dict[str, Any]]
    options: Optional[Dict[str, Any]] = {}


class ImportRequest(BaseModel):
    """Model for data import requests"""
    source_type: str = Field(..., description="Type of data source")
    source_url: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None
    mapping: Optional[Dict[str, str]] = {}
    options: Optional[Dict[str, Any]] = {}


class ExportRequest(BaseModel):
    """Model for data export requests"""
    format: str = Field(..., description="Export format (json, csv, graphml)")
    query: Optional[GraphQuery] = None
    include_properties: bool = True
    include_relationships: bool = True
    options: Optional[Dict[str, Any]] = {}