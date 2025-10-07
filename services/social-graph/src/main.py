"""
Social Graph Service - Neo4j Implementation
Manages relationships, interactions, and social dynamics
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any
import uvicorn
import os
from dotenv import load_dotenv
import logging
from prometheus_client import Counter, Histogram, generate_latest
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from .database import Neo4jConnection
from .models import (
    User, Relationship, Interaction,
    UserCreate, RelationshipCreate, InteractionCreate,
    GraphQuery, GraphResponse
)
from .services import SocialGraphService
from .auth import get_current_user
from .cache import RedisCache
from .monitoring import setup_monitoring

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Metrics
request_counter = Counter('social_graph_requests_total', 'Total requests', ['method', 'endpoint'])
request_duration = Histogram('social_graph_request_duration_seconds', 'Request duration')
query_counter = Counter('social_graph_queries_total', 'Total graph queries', ['query_type'])

# Initialize connections
neo4j_conn = None
redis_cache = None
graph_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    global neo4j_conn, redis_cache, graph_service

    # Startup
    logger.info("Starting Social Graph Service...")

    # Initialize Neo4j connection
    neo4j_conn = Neo4jConnection(
        uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        user=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "password123")
    )

    # Initialize Redis cache
    redis_cache = RedisCache(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379))
    )

    # Initialize service
    graph_service = SocialGraphService(neo4j_conn, redis_cache)

    # Create indexes and constraints
    await graph_service.initialize_schema()

    logger.info("Social Graph Service started successfully")

    yield

    # Shutdown
    logger.info("Shutting down Social Graph Service...")
    neo4j_conn.close()
    redis_cache.close()
    logger.info("Social Graph Service shut down")


# Create FastAPI app
app = FastAPI(
    title="Social Graph Service",
    description="Neo4j-based social graph management",
    version="1.0.0",
    lifespan=lifespan
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup OpenTelemetry instrumentation
FastAPIInstrumentor.instrument_app(app)

# Setup monitoring
setup_monitoring(app)


# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "social-graph",
        "version": "1.0.0"
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint"""
    if neo4j_conn and neo4j_conn.verify_connectivity():
        return {"status": "ready"}
    raise HTTPException(status_code=503, detail="Service not ready")


# User endpoints
@app.post("/users", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate):
    """Create a new user node"""
    try:
        result = await graph_service.create_user(user)
        request_counter.labels(method="POST", endpoint="/users").inc()
        return result
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    """Get user by ID"""
    try:
        result = await graph_service.get_user(user_id)
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        request_counter.labels(method="GET", endpoint="/users/{id}").inc()
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/{user_id}/relationships", response_model=List[Relationship])
async def get_user_relationships(user_id: str, relationship_type: Optional[str] = None):
    """Get all relationships for a user"""
    try:
        result = await graph_service.get_user_relationships(user_id, relationship_type)
        request_counter.labels(method="GET", endpoint="/users/{id}/relationships").inc()
        return result
    except Exception as e:
        logger.error(f"Error getting relationships: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Relationship endpoints
@app.post("/relationships", response_model=Relationship, status_code=status.HTTP_201_CREATED)
async def create_relationship(relationship: RelationshipCreate):
    """Create a relationship between users"""
    try:
        result = await graph_service.create_relationship(relationship)
        request_counter.labels(method="POST", endpoint="/relationships").inc()
        return result
    except Exception as e:
        logger.error(f"Error creating relationship: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/relationships/{relationship_id}")
async def delete_relationship(relationship_id: str):
    """Delete a relationship"""
    try:
        await graph_service.delete_relationship(relationship_id)
        request_counter.labels(method="DELETE", endpoint="/relationships/{id}").inc()
        return {"message": "Relationship deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting relationship: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Interaction endpoints
@app.post("/interactions", response_model=Interaction, status_code=status.HTTP_201_CREATED)
async def record_interaction(interaction: InteractionCreate):
    """Record an interaction between users"""
    try:
        result = await graph_service.record_interaction(interaction)
        request_counter.labels(method="POST", endpoint="/interactions").inc()
        return result
    except Exception as e:
        logger.error(f"Error recording interaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/interactions/{user_id}", response_model=List[Interaction])
async def get_user_interactions(
    user_id: str,
    interaction_type: Optional[str] = None,
    limit: int = 100
):
    """Get interactions for a user"""
    try:
        result = await graph_service.get_user_interactions(
            user_id, interaction_type, limit
        )
        request_counter.labels(method="GET", endpoint="/interactions/{id}").inc()
        return result
    except Exception as e:
        logger.error(f"Error getting interactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Graph query endpoints
@app.post("/query", response_model=GraphResponse)
async def execute_graph_query(query: GraphQuery):
    """Execute a custom Cypher query"""
    try:
        # Note: In production, validate and sanitize queries
        result = await graph_service.execute_query(query.cypher, query.parameters)
        query_counter.labels(query_type="custom").inc()
        return GraphResponse(data=result)
    except Exception as e:
        logger.error(f"Error executing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/paths/shortest")
async def find_shortest_path(
    source_id: str,
    target_id: str,
    max_hops: int = 6
):
    """Find shortest path between two users"""
    try:
        result = await graph_service.find_shortest_path(source_id, target_id, max_hops)
        if not result:
            raise HTTPException(status_code=404, detail="No path found")
        query_counter.labels(query_type="shortest_path").inc()
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding path: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/communities/{user_id}")
async def get_user_communities(user_id: str, algorithm: str = "louvain"):
    """Get communities for a user using graph algorithms"""
    try:
        result = await graph_service.detect_communities(user_id, algorithm)
        query_counter.labels(query_type="community_detection").inc()
        return result
    except Exception as e:
        logger.error(f"Error detecting communities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/influence/{user_id}/score")
async def calculate_influence_score(user_id: str):
    """Calculate influence score for a user"""
    try:
        result = await graph_service.calculate_influence_score(user_id)
        query_counter.labels(query_type="influence_score").inc()
        return {"user_id": user_id, "influence_score": result}
    except Exception as e:
        logger.error(f"Error calculating influence: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recommendations/{user_id}/connections")
async def recommend_connections(user_id: str, limit: int = 10):
    """Recommend new connections for a user"""
    try:
        result = await graph_service.recommend_connections(user_id, limit)
        query_counter.labels(query_type="recommendations").inc()
        return result
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()


# Admin endpoints
@app.post("/admin/reindex")
async def reindex_graph(admin_key: str = Depends(get_current_user)):
    """Reindex the graph database"""
    try:
        await graph_service.reindex()
        return {"message": "Graph reindexed successfully"}
    except Exception as e:
        logger.error(f"Error reindexing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/stats")
async def get_graph_stats(admin_key: str = Depends(get_current_user)):
    """Get graph statistics"""
    try:
        stats = await graph_service.get_statistics()
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )