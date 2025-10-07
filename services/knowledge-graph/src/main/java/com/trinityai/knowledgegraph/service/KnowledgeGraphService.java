package com.trinityai.knowledgegraph.service;

import com.trinityai.knowledgegraph.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.*;
import org.apache.jena.rdf.model.*;
import org.apache.jena.rdfconnection.RDFConnection;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.update.UpdateExecutionFactory;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateProcessor;
import org.apache.jena.update.UpdateRequest;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.StringReader;
import java.io.StringWriter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Core service for Knowledge Graph operations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeGraphService {

    private final RDFConnection rdfConnection;
    private final Model defaultModel;

    /**
     * Add triples to the knowledge graph
     */
    public TripleResponse addTriples(TripleRequest request) {
        Model tempModel = ModelFactory.createDefaultModel();
        int addedCount = 0;

        for (Triple triple : request.getTriples()) {
            Resource subject = tempModel.createResource(triple.getSubject());
            Property predicate = tempModel.createProperty(triple.getPredicate());

            if (triple.getObjectUri() != null) {
                Resource object = tempModel.createResource(triple.getObjectUri());
                tempModel.add(subject, predicate, object);
            } else if (triple.getObjectLiteral() != null) {
                Literal literal = tempModel.createLiteral(triple.getObjectLiteral());
                tempModel.add(subject, predicate, literal);
            }
            addedCount++;
        }

        // Add to Fuseki
        rdfConnection.load(tempModel);

        return TripleResponse.builder()
                .success(true)
                .message(String.format("Added %d triples", addedCount))
                .triplesAdded(addedCount)
                .build();
    }

    /**
     * Query triples from the knowledge graph
     */
    @Cacheable(value = "triples", key = "#subject + #predicate + #object")
    public List<Triple> queryTriples(String subject, String predicate, String object, int limit) {
        StringBuilder queryBuilder = new StringBuilder("SELECT ?s ?p ?o WHERE { ?s ?p ?o ");

        if (subject != null) {
            queryBuilder.append(String.format("FILTER(?s = <%s>) ", subject));
        }
        if (predicate != null) {
            queryBuilder.append(String.format("FILTER(?p = <%s>) ", predicate));
        }
        if (object != null) {
            queryBuilder.append(String.format("FILTER(?o = <%s>) ", object));
        }

        queryBuilder.append("} LIMIT ").append(limit);

        List<Triple> results = new ArrayList<>();

        try (QueryExecution qexec = rdfConnection.query(queryBuilder.toString())) {
            ResultSet rs = qexec.execSelect();
            while (rs.hasNext()) {
                QuerySolution solution = rs.nextSolution();
                Triple triple = Triple.builder()
                        .subject(solution.getResource("s").getURI())
                        .predicate(solution.getResource("p").getURI())
                        .objectUri(solution.get("o").isResource() ?
                                  solution.getResource("o").getURI() : null)
                        .objectLiteral(solution.get("o").isLiteral() ?
                                      solution.getLiteral("o").getString() : null)
                        .build();
                results.add(triple);
            }
        }

        return results;
    }

    /**
     * Delete triples from the knowledge graph
     */
    public void deleteTriples(TripleRequest request) {
        for (Triple triple : request.getTriples()) {
            String deleteQuery = String.format(
                "DELETE WHERE { <%s> <%s> %s }",
                triple.getSubject(),
                triple.getPredicate(),
                triple.getObjectUri() != null ?
                    "<" + triple.getObjectUri() + ">" :
                    "\"" + triple.getObjectLiteral() + "\""
            );

            UpdateRequest updateRequest = UpdateFactory.create(deleteQuery);
            rdfConnection.update(updateRequest);
        }
    }

    /**
     * Execute SPARQL SELECT/ASK query
     */
    public SparqlResponse executeSparqlQuery(String queryString) {
        Query query = QueryFactory.create(queryString);
        SparqlResponse response = SparqlResponse.builder().build();
        long startTime = System.currentTimeMillis();

        try (QueryExecution qexec = rdfConnection.query(query)) {
            if (query.isSelectType()) {
                ResultSet results = qexec.execSelect();
                List<Map<String, Object>> rows = new ArrayList<>();
                List<String> variables = results.getResultVars();

                while (results.hasNext()) {
                    QuerySolution solution = results.nextSolution();
                    Map<String, Object> row = new HashMap<>();

                    solution.varNames().forEachRemaining(varName -> {
                        RDFNode node = solution.get(varName);
                        if (node.isResource()) {
                            row.put(varName, node.asResource().getURI());
                        } else if (node.isLiteral()) {
                            row.put(varName, node.asLiteral().getValue());
                        }
                    });
                    rows.add(row);
                }

                response.setQueryType("SELECT");
                response.setVariables(variables);
                response.setResults(rows);
                response.setResultCount(rows.size());
            } else if (query.isAskType()) {
                boolean result = qexec.execAsk();
                response.setQueryType("ASK");
                response.setBooleanResult(result);
            }

            response.setSuccess(true);
            response.setExecutionTime(System.currentTimeMillis() - startTime);
        } catch (Exception e) {
            log.error("Error executing SPARQL query: {}", e.getMessage());
            response.setSuccess(false);
            response.setError(e.getMessage());
            response.setExecutionTime(System.currentTimeMillis() - startTime);
        }

        return response;
    }

    /**
     * Execute SPARQL UPDATE query
     */
    public UpdateResponse executeSparqlUpdate(String updateString) {
        UpdateResponse response = new UpdateResponse();

        try {
            UpdateRequest updateRequest = UpdateFactory.create(updateString);
            rdfConnection.update(updateRequest);

            response.setSuccess(true);
            response.setMessage("Update executed successfully");
        } catch (Exception e) {
            log.error("Error executing SPARQL update: {}", e.getMessage());
            response.setSuccess(false);
            response.setError(e.getMessage());
        }

        return response;
    }

    /**
     * Execute SPARQL CONSTRUCT query
     */
    public String executeSparqlConstruct(String queryString, String format) {
        Query query = QueryFactory.create(queryString);
        Model resultModel = ModelFactory.createDefaultModel();

        try (QueryExecution qexec = rdfConnection.query(query)) {
            resultModel = qexec.execConstruct();
        }

        // Serialize to requested format
        StringWriter writer = new StringWriter();
        RDFFormat rdfFormat = getRDFFormat(format);
        RDFDataMgr.write(writer, resultModel, rdfFormat);

        return writer.toString();
    }

    /**
     * Create an entity with properties
     */
    public EntityResponse createEntity(EntityRequest request) {
        Model model = ModelFactory.createDefaultModel();
        Resource entity = model.createResource(request.getUri());

        // Add type
        if (request.getType() != null) {
            entity.addProperty(
                model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                model.createResource(request.getType())
            );
        }

        // Add properties
        for (Map.Entry<String, Object> entry : request.getProperties().entrySet()) {
            Property prop = model.createProperty(entry.getKey());
            if (entry.getValue() instanceof String && ((String) entry.getValue()).startsWith("http")) {
                entity.addProperty(prop, model.createResource((String) entry.getValue()));
            } else {
                entity.addLiteral(prop, entry.getValue());
            }
        }

        rdfConnection.load(model);

        return EntityResponse.builder()
                .success(true)
                .uri(request.getUri())
                .message("Entity created successfully")
                .build();
    }

    /**
     * Get entity details
     */
    @Cacheable(value = "entities", key = "#uri")
    public EntityDetails getEntity(String uri) {
        String query = String.format(
            "SELECT ?p ?o WHERE { <%s> ?p ?o }", uri
        );

        EntityDetails details = new EntityDetails();
        details.setUri(uri);
        Map<String, List<Object>> properties = new HashMap<>();

        try (QueryExecution qexec = rdfConnection.query(query)) {
            ResultSet results = qexec.execSelect();

            while (results.hasNext()) {
                QuerySolution solution = results.nextSolution();
                String predicate = solution.getResource("p").getURI();
                RDFNode object = solution.get("o");

                Object value = object.isResource() ?
                    object.asResource().getURI() :
                    object.asLiteral().getValue();

                properties.computeIfAbsent(predicate, k -> new ArrayList<>()).add(value);
            }
        }

        details.setProperties(properties);
        return details;
    }

    /**
     * Update entity properties
     */
    public EntityResponse updateEntity(String uri, EntityUpdateRequest request) {
        // Delete old properties if specified
        if (request.getDeleteProperties() != null) {
            for (String prop : request.getDeleteProperties()) {
                String deleteQuery = String.format(
                    "DELETE WHERE { <%s> <%s> ?o }", uri, prop
                );
                rdfConnection.update(UpdateFactory.create(deleteQuery));
            }
        }

        // Add new properties
        if (request.getAddProperties() != null) {
            Model model = ModelFactory.createDefaultModel();
            Resource entity = model.createResource(uri);

            for (Map.Entry<String, Object> entry : request.getAddProperties().entrySet()) {
                Property prop = model.createProperty(entry.getKey());
                if (entry.getValue() instanceof String && ((String) entry.getValue()).startsWith("http")) {
                    entity.addProperty(prop, model.createResource((String) entry.getValue()));
                } else {
                    entity.addLiteral(prop, entry.getValue());
                }
            }

            rdfConnection.load(model);
        }

        return EntityResponse.builder()
                .success(true)
                .uri(uri)
                .message("Entity updated successfully")
                .build();
    }

    /**
     * Delete an entity
     */
    public void deleteEntity(String uri) {
        String deleteQuery = String.format(
            "DELETE WHERE { <%s> ?p ?o }", uri
        );
        rdfConnection.update(UpdateFactory.create(deleteQuery));

        // Also delete where this entity is an object
        String deleteAsObjectQuery = String.format(
            "DELETE WHERE { ?s ?p <%s> }", uri
        );
        rdfConnection.update(UpdateFactory.create(deleteAsObjectQuery));
    }

    /**
     * Get knowledge graph statistics
     */
    public GraphStatistics getStatistics() {
        GraphStatistics stats = new GraphStatistics();

        // Count total triples
        String countQuery = "SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }";
        try (QueryExecution qexec = rdfConnection.query(countQuery)) {
            ResultSet results = qexec.execSelect();
            if (results.hasNext()) {
                QuerySolution solution = results.nextSolution();
                stats.setTotalTriples(solution.getLiteral("count").getLong());
            }
        }

        // Count distinct subjects (entities)
        String subjectQuery = "SELECT (COUNT(DISTINCT ?s) as ?count) WHERE { ?s ?p ?o }";
        try (QueryExecution qexec = rdfConnection.query(subjectQuery)) {
            ResultSet results = qexec.execSelect();
            if (results.hasNext()) {
                QuerySolution solution = results.nextSolution();
                stats.setTotalEntities(solution.getLiteral("count").getLong());
            }
        }

        // Count distinct predicates
        String predicateQuery = "SELECT (COUNT(DISTINCT ?p) as ?count) WHERE { ?s ?p ?o }";
        try (QueryExecution qexec = rdfConnection.query(predicateQuery)) {
            ResultSet results = qexec.execSelect();
            if (results.hasNext()) {
                QuerySolution solution = results.nextSolution();
                stats.setTotalPredicates(solution.getLiteral("count").getLong());
            }
        }

        return stats;
    }

    /**
     * Find connected entities within a certain distance
     */
    public List<String> findConnectedEntities(String uri, int maxDistance) {
        Set<String> connected = new HashSet<>();
        Set<String> visited = new HashSet<>();
        Queue<String> queue = new LinkedList<>();

        queue.offer(uri);
        visited.add(uri);

        for (int distance = 0; distance < maxDistance && !queue.isEmpty(); distance++) {
            int levelSize = queue.size();

            for (int i = 0; i < levelSize; i++) {
                String current = queue.poll();

                // Query outgoing connections
                String query = String.format(
                    "SELECT ?o WHERE { <%s> ?p ?o . FILTER(isURI(?o)) }", current
                );

                try (QueryExecution qexec = rdfConnection.query(query)) {
                    ResultSet results = qexec.execSelect();
                    while (results.hasNext()) {
                        QuerySolution solution = results.nextSolution();
                        String neighbor = solution.getResource("o").getURI();

                        if (!visited.contains(neighbor)) {
                            visited.add(neighbor);
                            queue.offer(neighbor);
                            connected.add(neighbor);
                        }
                    }
                }
            }
        }

        return new ArrayList<>(connected);
    }

    /**
     * Find path between two entities
     */
    public PathResponse findPath(String from, String to, int maxLength) {
        // This is a simplified BFS path finding
        // In production, you might want to use SPARQL property paths

        Queue<List<String>> queue = new LinkedList<>();
        Set<String> visited = new HashSet<>();

        List<String> initialPath = new ArrayList<>();
        initialPath.add(from);
        queue.offer(initialPath);
        visited.add(from);

        while (!queue.isEmpty()) {
            List<String> path = queue.poll();

            if (path.size() > maxLength) {
                break;
            }

            String current = path.get(path.size() - 1);

            if (current.equals(to)) {
                return PathResponse.builder()
                        .found(true)
                        .path(path)
                        .length(path.size() - 1)
                        .build();
            }

            // Query neighbors
            String query = String.format(
                "SELECT ?o WHERE { <%s> ?p ?o . FILTER(isURI(?o)) }", current
            );

            try (QueryExecution qexec = rdfConnection.query(query)) {
                ResultSet results = qexec.execSelect();
                while (results.hasNext()) {
                    QuerySolution solution = results.nextSolution();
                    String neighbor = solution.getResource("o").getURI();

                    if (!visited.contains(neighbor)) {
                        visited.add(neighbor);
                        List<String> newPath = new ArrayList<>(path);
                        newPath.add(neighbor);
                        queue.offer(newPath);
                    }
                }
            }
        }

        return PathResponse.builder()
                .found(false)
                .build();
    }

    /**
     * Export graph in specified format
     */
    public String exportGraph(String format, String graphUri) {
        Model model;

        if (graphUri != null) {
            // Export specific named graph
            String query = String.format(
                "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <%s> { ?s ?p ?o } }", graphUri
            );
            try (QueryExecution qexec = rdfConnection.query(query)) {
                model = qexec.execConstruct();
            }
        } else {
            // Export default graph
            String query = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";
            try (QueryExecution qexec = rdfConnection.query(query)) {
                model = qexec.execConstruct();
            }
        }

        StringWriter writer = new StringWriter();
        RDFDataMgr.write(writer, model, getRDFFormat(format));
        return writer.toString();
    }

    /**
     * Import data into the graph
     */
    public ImportResponse importData(String data, String format, String graphUri) {
        ImportResponse response = new ImportResponse();

        try {
            Model model = ModelFactory.createDefaultModel();
            StringReader reader = new StringReader(data);
            RDFDataMgr.read(model, reader, null, getRDFFormat(format).getLang());

            if (graphUri != null) {
                rdfConnection.load(graphUri, model);
            } else {
                rdfConnection.load(model);
            }

            response.setSuccess(true);
            response.setTriplesImported(model.size());
            response.setMessage(String.format("Imported %d triples", model.size()));
        } catch (Exception e) {
            log.error("Error importing data: {}", e.getMessage());
            response.setSuccess(false);
            response.setError(e.getMessage());
        }

        return response;
    }

    private RDFFormat getRDFFormat(String format) {
        switch (format.toUpperCase()) {
            case "JSON-LD":
                return RDFFormat.JSONLD;
            case "RDF/XML":
            case "XML":
                return RDFFormat.RDFXML;
            case "N3":
                return RDFFormat.N3;
            case "N-TRIPLES":
            case "NT":
                return RDFFormat.NTRIPLES;
            case "TURTLE":
            case "TTL":
            default:
                return RDFFormat.TURTLE;
        }
    }
}