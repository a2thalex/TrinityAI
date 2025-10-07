"""
Social Graph Service Business Logic
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import json
import logging
from .database import Neo4jConnection
from .cache import RedisCache
from .models import (
    User, UserCreate,
    Relationship, RelationshipCreate,
    Interaction, InteractionCreate,
    PathResult, CommunityResult, RecommendationResult,
    InfluenceMetrics, GraphStatistics
)

logger = logging.getLogger(__name__)


class SocialGraphService:
    """Service for managing social graph operations"""

    def __init__(self, db: Neo4jConnection, cache: RedisCache):
        """Initialize service with database and cache connections"""
        self.db = db
        self.cache = cache

    async def initialize_schema(self):
        """Initialize database schema with indexes and constraints"""
        await self.db.create_constraints()
        await self.db.create_indexes()
        logger.info("Database schema initialized")

    # User Management
    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user in the graph"""
        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        query = """
        CREATE (u:User {
            id: $id,
            username: $username,
            email: $email,
            name: $name,
            bio: $bio,
            avatar_url: $avatar_url,
            location: $location,
            created_at: $created_at,
            updated_at: $updated_at,
            metadata: $metadata,
            tags: $tags
        })
        RETURN u
        """

        params = {
            "id": user_id,
            "username": user_data.username,
            "email": user_data.email,
            "name": user_data.name,
            "bio": user_data.bio,
            "avatar_url": user_data.avatar_url,
            "location": user_data.location,
            "created_at": now,
            "updated_at": now,
            "metadata": json.dumps(user_data.metadata),
            "tags": user_data.tags or []
        }

        result = await self.db.execute_write(query, params)

        # Clear cache
        await self.cache.delete(f"user:{user_id}")

        return User(**result[0]["u"], id=user_id)

    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        # Check cache first
        cached = await self.cache.get(f"user:{user_id}")
        if cached:
            return User(**json.loads(cached))

        query = """
        MATCH (u:User {id: $id})
        OPTIONAL MATCH (u)-[r]-()
        RETURN u, count(r) as node_degree
        """

        result = await self.db.execute_read(query, {"id": user_id})

        if not result:
            return None

        user_data = result[0]["u"]
        user_data["node_degree"] = result[0]["node_degree"]

        # Cache the result
        await self.cache.set(f"user:{user_id}", json.dumps(user_data), expire=300)

        return User(**user_data)

    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> User:
        """Update user properties"""
        updates["updated_at"] = datetime.utcnow().isoformat()

        set_clause = ", ".join([f"u.{key} = ${key}" for key in updates.keys()])
        query = f"""
        MATCH (u:User {{id: $id}})
        SET {set_clause}
        RETURN u
        """

        params = {"id": user_id, **updates}
        result = await self.db.execute_write(query, params)

        # Clear cache
        await self.cache.delete(f"user:{user_id}")

        return User(**result[0]["u"])

    async def delete_user(self, user_id: str):
        """Delete user and all their relationships"""
        query = """
        MATCH (u:User {id: $id})
        DETACH DELETE u
        """

        await self.db.execute_write(query, {"id": user_id})

        # Clear cache
        await self.cache.delete(f"user:{user_id}")

    # Relationship Management
    async def create_relationship(self, rel_data: RelationshipCreate) -> Relationship:
        """Create a relationship between users"""
        rel_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        query = """
        MATCH (a:User {id: $from_id}), (b:User {id: $to_id})
        CREATE (a)-[r:RELATES_TO {
            id: $id,
            type: $type,
            weight: $weight,
            properties: $properties,
            created_at: $created_at,
            updated_at: $updated_at
        }]->(b)
        """

        if rel_data.bidirectional:
            query += """
            CREATE (b)-[r2:RELATES_TO {
                id: $id2,
                type: $type,
                weight: $weight,
                properties: $properties,
                created_at: $created_at,
                updated_at: $updated_at
            }]->(a)
            """

        query += """
        RETURN a, b, r
        """

        params = {
            "id": rel_id,
            "id2": str(uuid.uuid4()) if rel_data.bidirectional else None,
            "from_id": rel_data.from_user_id,
            "to_id": rel_data.to_user_id,
            "type": rel_data.type.value,
            "weight": rel_data.weight,
            "properties": json.dumps(rel_data.properties),
            "created_at": now,
            "updated_at": now
        }

        result = await self.db.execute_write(query, params)

        # Clear cache for both users
        await self.cache.delete(f"user:{rel_data.from_user_id}:relationships")
        await self.cache.delete(f"user:{rel_data.to_user_id}:relationships")

        return Relationship(
            id=rel_id,
            type=rel_data.type,
            from_user=User(**result[0]["a"]),
            to_user=User(**result[0]["b"]),
            created_at=now,
            updated_at=now,
            properties=rel_data.properties,
            weight=rel_data.weight
        )

    async def get_user_relationships(self, user_id: str, rel_type: Optional[str] = None) -> List[Relationship]:
        """Get all relationships for a user"""
        cache_key = f"user:{user_id}:relationships:{rel_type or 'all'}"
        cached = await self.cache.get(cache_key)
        if cached:
            return [Relationship(**r) for r in json.loads(cached)]

        query = """
        MATCH (u:User {id: $id})-[r:RELATES_TO]-(other:User)
        """

        if rel_type:
            query += " WHERE r.type = $rel_type"

        query += """
        RETURN r, u, other,
               CASE WHEN startNode(r) = u THEN 'outgoing' ELSE 'incoming' END as direction
        ORDER BY r.created_at DESC
        """

        params = {"id": user_id}
        if rel_type:
            params["rel_type"] = rel_type

        results = await self.db.execute_read(query, params)

        relationships = []
        for result in results:
            rel = Relationship(
                id=result["r"]["id"],
                type=result["r"]["type"],
                from_user=User(**result["u"]) if result["direction"] == "outgoing" else User(**result["other"]),
                to_user=User(**result["other"]) if result["direction"] == "outgoing" else User(**result["u"]),
                created_at=result["r"]["created_at"],
                updated_at=result["r"]["updated_at"],
                properties=json.loads(result["r"].get("properties", "{}")),
                weight=result["r"].get("weight", 1.0)
            )
            relationships.append(rel)

        # Cache results
        await self.cache.set(cache_key, json.dumps([r.dict() for r in relationships]), expire=60)

        return relationships

    async def delete_relationship(self, rel_id: str):
        """Delete a relationship"""
        query = """
        MATCH ()-[r:RELATES_TO {id: $id}]-()
        DELETE r
        """

        await self.db.execute_write(query, {"id": rel_id})

    # Interaction Management
    async def record_interaction(self, interaction_data: InteractionCreate) -> Interaction:
        """Record an interaction between users"""
        interaction_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        query = """
        MATCH (from:User {id: $from_id}), (to:User {id: $to_id})
        CREATE (i:Interaction {
            id: $id,
            type: $type,
            from_user_id: $from_id,
            to_user_id: $to_id,
            entity_id: $entity_id,
            entity_type: $entity_type,
            content: $content,
            metadata: $metadata,
            timestamp: $timestamp,
            processed: false
        })
        CREATE (from)-[:INITIATED]->(i)-[:TARGETED]->(to)
        RETURN i
        """

        params = {
            "id": interaction_id,
            "type": interaction_data.type.value,
            "from_id": interaction_data.from_user_id,
            "to_id": interaction_data.to_user_id,
            "entity_id": interaction_data.entity_id,
            "entity_type": interaction_data.entity_type,
            "content": interaction_data.content,
            "metadata": json.dumps(interaction_data.metadata),
            "timestamp": now
        }

        result = await self.db.execute_write(query, params)

        return Interaction(**result[0]["i"])

    async def get_user_interactions(
        self,
        user_id: str,
        interaction_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Interaction]:
        """Get interactions for a user"""
        query = """
        MATCH (u:User {id: $id})-[:INITIATED|TARGETED]-(i:Interaction)
        """

        if interaction_type:
            query += " WHERE i.type = $type"

        query += """
        RETURN i
        ORDER BY i.timestamp DESC
        LIMIT $limit
        """

        params = {"id": user_id, "limit": limit}
        if interaction_type:
            params["type"] = interaction_type

        results = await self.db.execute_read(query, params)

        return [Interaction(**r["i"]) for r in results]

    # Graph Algorithms
    async def find_shortest_path(self, source_id: str, target_id: str, max_hops: int = 6) -> Optional[PathResult]:
        """Find shortest path between two users"""
        result = await self.db.shortest_path(source_id, target_id, max_hops)

        if not result:
            return None

        # Process path into structured result
        nodes = []
        relationships = []

        # Fetch full node details
        node_query = """
        MATCH (u:User)
        WHERE u.id IN $node_ids
        RETURN u
        """

        node_results = await self.db.execute_read(node_query, {"node_ids": result["node_ids"]})
        nodes = [User(**n["u"]) for n in node_results]

        return PathResult(
            path=result.get("path", []),
            length=result["path_length"],
            nodes=nodes,
            relationships=relationships
        )

    async def detect_communities(self, user_id: str, algorithm: str = "louvain") -> List[CommunityResult]:
        """Detect communities for a user"""
        communities = await self.db.community_detection(algorithm)

        # Find user's community
        user_community = next((c for c in communities if c["id"] == user_id), None)
        if not user_community:
            return []

        # Get all members of the community
        community_members = [c for c in communities if c["communityId"] == user_community["communityId"]]

        # Fetch full user details
        query = """
        MATCH (u:User)
        WHERE u.id IN $ids
        RETURN u
        """

        user_results = await self.db.execute_read(query, {"ids": [m["id"] for m in community_members]})
        members = [User(**u["u"]) for u in user_results]

        # Calculate community metrics
        density = await self._calculate_community_density(community_members)

        return [CommunityResult(
            community_id=str(user_community["communityId"]),
            members=members,
            size=len(members),
            density=density
        )]

    async def calculate_influence_score(self, user_id: str) -> float:
        """Calculate influence score for a user"""
        centrality = await self.db.centrality_measures(user_id)

        # Weighted combination of centrality measures
        score = (
            centrality.get("degree", 0) * 0.3 +
            centrality.get("betweenness", 0) * 0.4 +
            centrality.get("closeness", 0) * 0.3
        )

        # Normalize to 0-100 scale
        return min(100, score * 10)

    async def recommend_connections(self, user_id: str, limit: int = 10) -> List[RecommendationResult]:
        """Recommend new connections for a user"""
        query = """
        MATCH (u:User {id: $id})-[:RELATES_TO*2..3]-(recommended:User)
        WHERE NOT (u)-[:RELATES_TO]-(recommended) AND u <> recommended
        WITH recommended, COUNT(*) as mutual_count
        ORDER BY mutual_count DESC
        LIMIT $limit
        MATCH (u:User {id: $id})-[:RELATES_TO]-(mutual:User)-[:RELATES_TO]-(recommended)
        WITH recommended, mutual_count, COLLECT(DISTINCT mutual) as mutual_connections
        RETURN recommended, mutual_count, mutual_connections
        """

        results = await self.db.execute_read(query, {"id": user_id, "limit": limit})

        recommendations = []
        for r in results:
            recommendations.append(RecommendationResult(
                user=User(**r["recommended"]),
                score=r["mutual_count"] / 10.0,  # Normalize score
                reason=f"You have {r['mutual_count']} mutual connections",
                mutual_connections=[User(**m) for m in r["mutual_connections"]][:5]
            ))

        return recommendations

    # Graph Statistics
    async def get_statistics(self) -> GraphStatistics:
        """Get comprehensive graph statistics"""
        stats = await self.db.get_statistics()

        # Get type distributions
        node_type_query = """
        MATCH (n)
        RETURN labels(n)[0] as type, count(n) as count
        """
        node_types = await self.db.execute_read(node_type_query)

        rel_type_query = """
        MATCH ()-[r]->()
        RETURN type(r) as type, count(r) as count
        """
        rel_types = await self.db.execute_read(rel_type_query)

        return GraphStatistics(
            total_nodes=stats.get("total_nodes", 0),
            total_relationships=stats.get("total_relationships", 0),
            node_types={t["type"]: t["count"] for t in node_types},
            relationship_types={t["type"]: t["count"] for t in rel_types},
            average_degree=stats.get("avg_degree", 0),
            graph_density=stats.get("total_relationships", 0) / max(stats.get("total_nodes", 1) ** 2, 1),
            component_count=1,  # Simplified for now
            largest_component_size=stats.get("total_nodes", 0),
            average_clustering=0.0  # Would require additional computation
        )

    # Helper Methods
    async def _calculate_community_density(self, members: List[Dict]) -> float:
        """Calculate density of a community"""
        if len(members) < 2:
            return 0.0

        query = """
        MATCH (a:User)-[r:RELATES_TO]-(b:User)
        WHERE a.id IN $ids AND b.id IN $ids AND a.id < b.id
        RETURN count(r) as edge_count
        """

        result = await self.db.execute_read(query, {"ids": [m["id"] for m in members]})
        edge_count = result[0]["edge_count"] if result else 0

        max_edges = len(members) * (len(members) - 1) / 2
        return edge_count / max_edges if max_edges > 0 else 0.0

    async def execute_query(self, cypher: str, parameters: Dict[str, Any] = None) -> Any:
        """Execute a custom Cypher query"""
        # Note: In production, this should validate and sanitize queries
        return await self.db.execute_read(cypher, parameters)

    async def reindex(self):
        """Reindex the graph database"""
        await self.db.create_constraints()
        await self.db.create_indexes()
        logger.info("Graph reindexed successfully")