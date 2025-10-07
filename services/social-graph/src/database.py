"""
Neo4j Database Connection and Query Management
"""

from neo4j import GraphDatabase, AsyncGraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError
from typing import Dict, List, Any, Optional
import logging
import asyncio
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class Neo4jConnection:
    """Manages Neo4j database connections and queries"""

    def __init__(self, uri: str, user: str, password: str):
        """Initialize Neo4j connection"""
        self.uri = uri
        self.user = user
        self.password = password
        self._driver = None
        self._async_driver = None

    def connect(self):
        """Create synchronous connection to Neo4j"""
        try:
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_lifetime=3600,
                max_connection_pool_size=50,
                connection_acquisition_timeout=60
            )
            self._driver.verify_connectivity()
            logger.info("Connected to Neo4j successfully")
        except (ServiceUnavailable, AuthError) as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            raise

    async def connect_async(self):
        """Create asynchronous connection to Neo4j"""
        try:
            self._async_driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_lifetime=3600,
                max_connection_pool_size=50
            )
            await self._async_driver.verify_connectivity()
            logger.info("Connected to Neo4j asynchronously")
        except (ServiceUnavailable, AuthError) as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            raise

    def close(self):
        """Close database connections"""
        if self._driver:
            self._driver.close()
        if self._async_driver:
            self._async_driver.close()
        logger.info("Neo4j connections closed")

    def verify_connectivity(self) -> bool:
        """Verify database connectivity"""
        try:
            if self._driver:
                self._driver.verify_connectivity()
                return True
            return False
        except:
            return False

    async def execute_query(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict]:
        """Execute a Cypher query asynchronously"""
        if not self._async_driver:
            await self.connect_async()

        async with self._async_driver.session() as session:
            try:
                result = await session.run(query, parameters or {})
                return [record.data() async for record in result]
            except Exception as e:
                logger.error(f"Query execution failed: {e}")
                raise

    async def execute_write(self, query: str, parameters: Dict[str, Any] = None) -> Any:
        """Execute a write transaction"""
        if not self._async_driver:
            await self.connect_async()

        async def work(tx):
            result = await tx.run(query, parameters or {})
            return [record.data() async for record in result]

        async with self._async_driver.session() as session:
            try:
                return await session.execute_write(work)
            except Exception as e:
                logger.error(f"Write transaction failed: {e}")
                raise

    async def execute_read(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict]:
        """Execute a read transaction"""
        if not self._async_driver:
            await self.connect_async()

        async def work(tx):
            result = await tx.run(query, parameters or {})
            return [record.data() async for record in result]

        async with self._async_driver.session() as session:
            try:
                return await session.execute_read(work)
            except Exception as e:
                logger.error(f"Read transaction failed: {e}")
                raise

    async def create_indexes(self):
        """Create database indexes for performance"""
        indexes = [
            "CREATE INDEX user_id IF NOT EXISTS FOR (u:User) ON (u.id)",
            "CREATE INDEX user_username IF NOT EXISTS FOR (u:User) ON (u.username)",
            "CREATE INDEX user_email IF NOT EXISTS FOR (u:User) ON (u.email)",
            "CREATE INDEX interaction_timestamp IF NOT EXISTS FOR (i:Interaction) ON (i.timestamp)",
            "CREATE INDEX relationship_type IF NOT EXISTS FOR ()-[r:RELATES_TO]-() ON (r.type)",
        ]

        for index in indexes:
            try:
                await self.execute_write(index)
                logger.info(f"Created index: {index}")
            except Exception as e:
                logger.warning(f"Index creation skipped or failed: {e}")

    async def create_constraints(self):
        """Create database constraints for data integrity"""
        constraints = [
            "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
            "CREATE CONSTRAINT user_username_unique IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE",
        ]

        for constraint in constraints:
            try:
                await self.execute_write(constraint)
                logger.info(f"Created constraint: {constraint}")
            except Exception as e:
                logger.warning(f"Constraint creation skipped or failed: {e}")

    # Graph Algorithms
    async def shortest_path(self, start_id: str, end_id: str, max_hops: int = 6) -> Optional[List[Dict]]:
        """Find shortest path between two nodes"""
        query = """
        MATCH (start:User {id: $start_id}), (end:User {id: $end_id})
        MATCH path = shortestPath((start)-[*..%d]-(end))
        RETURN path,
               [node in nodes(path) | node.id] as node_ids,
               length(path) as path_length
        """ % max_hops

        result = await self.execute_read(query, {
            "start_id": start_id,
            "end_id": end_id
        })

        return result[0] if result else None

    async def page_rank(self, iterations: int = 20, damping_factor: float = 0.85) -> List[Dict]:
        """Calculate PageRank for all nodes"""
        query = """
        CALL gds.pageRank.stream({
            nodeProjection: 'User',
            relationshipProjection: 'RELATES_TO',
            maxIterations: $iterations,
            dampingFactor: $damping_factor
        })
        YIELD nodeId, score
        RETURN gds.util.asNode(nodeId).id AS id, score
        ORDER BY score DESC
        LIMIT 100
        """

        return await self.execute_read(query, {
            "iterations": iterations,
            "damping_factor": damping_factor
        })

    async def community_detection(self, algorithm: str = "louvain") -> List[Dict]:
        """Detect communities in the graph"""
        if algorithm == "louvain":
            query = """
            CALL gds.louvain.stream({
                nodeProjection: 'User',
                relationshipProjection: 'RELATES_TO'
            })
            YIELD nodeId, communityId
            RETURN gds.util.asNode(nodeId).id AS id, communityId
            """
        else:
            query = """
            CALL gds.labelPropagation.stream({
                nodeProjection: 'User',
                relationshipProjection: 'RELATES_TO',
                maxIterations: 10
            })
            YIELD nodeId, communityId
            RETURN gds.util.asNode(nodeId).id AS id, communityId
            """

        return await self.execute_read(query)

    async def centrality_measures(self, user_id: str) -> Dict[str, float]:
        """Calculate various centrality measures for a user"""
        queries = {
            "degree": """
                MATCH (u:User {id: $user_id})
                OPTIONAL MATCH (u)-[r]-()
                RETURN count(r) as degree
            """,
            "betweenness": """
                CALL gds.betweenness.stream({
                    nodeProjection: 'User',
                    relationshipProjection: 'RELATES_TO'
                })
                YIELD nodeId, score
                WHERE gds.util.asNode(nodeId).id = $user_id
                RETURN score
            """,
            "closeness": """
                CALL gds.closeness.stream({
                    nodeProjection: 'User',
                    relationshipProjection: 'RELATES_TO'
                })
                YIELD nodeId, score
                WHERE gds.util.asNode(nodeId).id = $user_id
                RETURN score
            """
        }

        results = {}
        for measure, query in queries.items():
            try:
                result = await self.execute_read(query, {"user_id": user_id})
                results[measure] = result[0].get("score" if measure != "degree" else "degree", 0) if result else 0
            except:
                results[measure] = 0

        return results

    async def get_statistics(self) -> Dict[str, Any]:
        """Get graph statistics"""
        query = """
        MATCH (n)
        WITH count(n) as node_count
        MATCH ()-[r]->()
        WITH node_count, count(r) as rel_count
        MATCH (u:User)
        WITH node_count, rel_count, count(u) as user_count
        RETURN {
            total_nodes: node_count,
            total_relationships: rel_count,
            total_users: user_count,
            avg_degree: toFloat(rel_count) / toFloat(node_count)
        } as stats
        """

        result = await self.execute_read(query)
        return result[0]["stats"] if result else {}

    # Bulk Operations
    async def bulk_create_nodes(self, nodes: List[Dict[str, Any]], label: str = "User"):
        """Create multiple nodes in a single transaction"""
        query = f"""
        UNWIND $nodes as node
        CREATE (n:{label})
        SET n = node
        RETURN n.id as id
        """

        return await self.execute_write(query, {"nodes": nodes})

    async def bulk_create_relationships(self, relationships: List[Dict[str, Any]]):
        """Create multiple relationships in a single transaction"""
        query = """
        UNWIND $relationships as rel
        MATCH (a:User {id: rel.from_id}), (b:User {id: rel.to_id})
        CREATE (a)-[r:RELATES_TO {type: rel.type, properties: rel.properties}]->(b)
        RETURN r
        """

        return await self.execute_write(query, {"relationships": relationships})

    # Data Import/Export
    async def export_subgraph(self, user_id: str, depth: int = 2) -> Dict[str, Any]:
        """Export a subgraph centered on a user"""
        query = """
        MATCH (center:User {id: $user_id})
        CALL apoc.path.subgraphAll(center, {
            maxLevel: $depth,
            relationshipFilter: "RELATES_TO"
        })
        YIELD nodes, relationships
        RETURN nodes, relationships
        """

        result = await self.execute_read(query, {
            "user_id": user_id,
            "depth": depth
        })

        if result:
            return {
                "nodes": [dict(node) for node in result[0]["nodes"]],
                "relationships": [dict(rel) for rel in result[0]["relationships"]]
            }
        return {"nodes": [], "relationships": []}