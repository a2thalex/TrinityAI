# Knowledge Graph Service

RDF/SPARQL knowledge graph service using Apache Jena for the AI Awareness System.

## Overview

The Knowledge Graph Service provides comprehensive RDF triple store capabilities with SPARQL query support, ontology management, reasoning, and inference capabilities. It integrates with Apache Jena Fuseki for persistent storage and supports multiple RDF formats.

## Features

### Core Capabilities
- **RDF Triple Management**: CRUD operations for RDF triples
- **SPARQL Support**: Full SPARQL 1.1 query and update support
- **Ontology Management**: Load, validate, and query ontologies (OWL, RDFS)
- **Reasoning & Inference**: Multiple reasoner support (OWL, RDFS, custom rules)
- **Data Validation**: Validate data against ontologies with suggested fixes
- **Consistency Checking**: Graph-wide consistency validation
- **Entity Management**: High-level entity CRUD with properties
- **Graph Analysis**: Path finding, statistics, connected components
- **Import/Export**: Support for multiple RDF formats

### Technical Features
- RESTful API with OpenAPI documentation
- Redis caching for improved performance
- Prometheus metrics and health endpoints
- Async operations support
- Comprehensive error handling
- Docker containerization

## Technology Stack

- **Java 17**: Primary language
- **Spring Boot 3.2.0**: Application framework
- **Apache Jena 4.10.0**: RDF and SPARQL processing
- **Apache Jena Fuseki**: Triple store backend
- **Redis**: Caching layer
- **Micrometer**: Metrics collection
- **SpringDoc**: OpenAPI documentation

## API Endpoints

### Triple Operations
- `POST /api/v1/knowledge/triples` - Add RDF triples
- `GET /api/v1/knowledge/triples` - Query triples
- `DELETE /api/v1/knowledge/triples` - Delete triples

### SPARQL Operations
- `POST /api/v1/knowledge/sparql/query` - Execute SELECT/ASK queries
- `POST /api/v1/knowledge/sparql/update` - Execute UPDATE queries
- `POST /api/v1/knowledge/sparql/construct` - Execute CONSTRUCT queries

### Ontology Management
- `POST /api/v1/knowledge/ontologies` - Load ontology
- `GET /api/v1/knowledge/ontologies` - List ontologies
- `GET /api/v1/knowledge/ontologies/{id}/classes` - Get ontology classes
- `GET /api/v1/knowledge/ontologies/{id}/properties` - Get ontology properties

### Reasoning & Validation
- `POST /api/v1/knowledge/reasoning/infer` - Perform inference
- `POST /api/v1/knowledge/reasoning/validate` - Validate data
- `POST /api/v1/knowledge/reasoning/consistency` - Check consistency

### Entity Management
- `POST /api/v1/knowledge/entities` - Create entity
- `GET /api/v1/knowledge/entities/{uri}` - Get entity details
- `PUT /api/v1/knowledge/entities/{uri}` - Update entity
- `DELETE /api/v1/knowledge/entities/{uri}` - Delete entity

### Graph Analysis
- `GET /api/v1/knowledge/analysis/statistics` - Graph statistics
- `GET /api/v1/knowledge/analysis/connected` - Find connected entities
- `GET /api/v1/knowledge/analysis/path` - Find path between entities

### Import/Export
- `GET /api/v1/knowledge/export` - Export graph data
- `POST /api/v1/knowledge/import` - Import RDF data

## Configuration

Key configuration properties in `application.yml`:

```yaml
jena:
  fuseki:
    url: http://localhost:3030
    dataset: knowledge
  reasoning:
    enabled: true
    type: OWL
```

## Data Models

### Triple
Basic RDF triple representation:
```java
{
  "subject": "http://example.org/person/123",
  "predicate": "http://xmlns.com/foaf/0.1/name",
  "objectLiteral": "John Doe"
}
```

### SPARQL Query Request
```java
{
  "query": "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10",
  "enableReasoning": true
}
```

### Entity Request
```java
{
  "uri": "http://example.org/person/123",
  "type": "http://xmlns.com/foaf/0.1/Person",
  "properties": {
    "http://xmlns.com/foaf/0.1/name": "John Doe",
    "http://xmlns.com/foaf/0.1/age": 30
  }
}
```

## Reasoning Types

Supported reasoners:
- **OWL**: Full OWL reasoning
- **RDFS**: RDFS entailment rules
- **OWL_MICRO**: Lightweight OWL subset
- **OWL_MINI**: Minimal OWL reasoning
- **TRANSITIVE**: Transitive property reasoning
- **RULE_BASED**: Custom rule-based reasoning

## Validation Features

### Validation Rules
- Domain/range checking
- Cardinality constraints
- Disjointness validation
- Functional property checking
- Datatype validation
- Custom SPARQL constraints

### Consistency Checks
- Logical consistency
- Structural integrity
- Semantic consistency
- Constraint violations
- Orphaned entities
- Cyclic dependencies

## RDF Format Support

Import/Export formats:
- Turtle (TTL)
- RDF/XML
- JSON-LD
- N-Triples
- N3
- TriG

## Performance Considerations

- Redis caching for frequent queries
- Configurable query timeouts
- Batch import/export operations
- Async processing for heavy operations
- Connection pooling to Fuseki

## Running Locally

```bash
# Build the service
mvn clean package

# Run with default configuration
java -jar target/knowledge-graph-*.jar

# Run with custom Fuseki URL
java -jar target/knowledge-graph-*.jar --jena.fuseki.url=http://fuseki:3030
```

## Docker

```bash
# Build Docker image
docker build -t knowledge-graph-service .

# Run container
docker run -p 8002:8002 \
  -e FUSEKI_URL=http://fuseki:3030 \
  -e REDIS_HOST=redis \
  knowledge-graph-service
```

## API Documentation

- Swagger UI: http://localhost:8002/swagger-ui
- OpenAPI JSON: http://localhost:8002/api-docs

## Health & Metrics

- Health: http://localhost:8002/actuator/health
- Metrics: http://localhost:8002/actuator/metrics
- Prometheus: http://localhost:8002/actuator/prometheus

## Testing

```bash
# Run unit tests
mvn test

# Run integration tests
mvn verify

# Test SPARQL query
curl -X POST http://localhost:8002/api/v1/knowledge/sparql/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * WHERE { ?s ?p ?o } LIMIT 10"}'
```

## License

Part of the TrinityAI - AI Awareness System