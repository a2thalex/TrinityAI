package com.trinityai.knowledgegraph.controller;

import com.trinityai.knowledgegraph.dto.*;
import com.trinityai.knowledgegraph.service.KnowledgeGraphService;
import com.trinityai.knowledgegraph.service.OntologyService;
import com.trinityai.knowledgegraph.service.ReasoningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * REST API Controller for Knowledge Graph operations
 */
@RestController
@RequestMapping("/api/v1/knowledge")
@RequiredArgsConstructor
@Validated
@Slf4j
@Tag(name = "Knowledge Graph", description = "RDF and SPARQL operations")
public class KnowledgeGraphController {

    private final KnowledgeGraphService knowledgeGraphService;
    private final OntologyService ontologyService;
    private final ReasoningService reasoningService;

    // Health Check
    @GetMapping("/health")
    @Operation(summary = "Health check endpoint")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "knowledge-graph",
            "version", "1.0.0"
        ));
    }

    // Triple Operations
    @PostMapping("/triples")
    @Operation(summary = "Add RDF triples to the knowledge graph")
    public ResponseEntity<TripleResponse> addTriples(@Valid @RequestBody TripleRequest request) {
        log.info("Adding {} triples to graph", request.getTriples().size());
        TripleResponse response = knowledgeGraphService.addTriples(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/triples")
    @Operation(summary = "Query triples by subject, predicate, or object")
    public ResponseEntity<List<Triple>> queryTriples(
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String predicate,
            @RequestParam(required = false) String object,
            @RequestParam(defaultValue = "100") int limit) {
        log.info("Querying triples: subject={}, predicate={}, object={}", subject, predicate, object);
        List<Triple> triples = knowledgeGraphService.queryTriples(subject, predicate, object, limit);
        return ResponseEntity.ok(triples);
    }

    @DeleteMapping("/triples")
    @Operation(summary = "Delete triples from the knowledge graph")
    public ResponseEntity<Void> deleteTriples(@Valid @RequestBody TripleRequest request) {
        log.info("Deleting {} triples from graph", request.getTriples().size());
        knowledgeGraphService.deleteTriples(request);
        return ResponseEntity.noContent().build();
    }

    // SPARQL Operations
    @PostMapping("/sparql/query")
    @Operation(summary = "Execute a SPARQL SELECT/ASK query")
    public ResponseEntity<SparqlResponse> executeSparqlQuery(@Valid @RequestBody SparqlQueryRequest request) {
        log.info("Executing SPARQL query: {}", request.getQuery().substring(0, Math.min(100, request.getQuery().length())));
        SparqlResponse response = knowledgeGraphService.executeSparqlQuery(request.getQuery());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sparql/update")
    @Operation(summary = "Execute a SPARQL UPDATE query")
    public ResponseEntity<UpdateResponse> executeSparqlUpdate(@Valid @RequestBody SparqlUpdateRequest request) {
        log.info("Executing SPARQL update");
        UpdateResponse response = knowledgeGraphService.executeSparqlUpdate(request.getUpdate());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sparql/construct")
    @Operation(summary = "Execute a SPARQL CONSTRUCT query")
    public ResponseEntity<String> executeSparqlConstruct(
            @Valid @RequestBody SparqlQueryRequest request,
            @RequestParam(defaultValue = "TURTLE") String format) {
        log.info("Executing SPARQL CONSTRUCT query with format: {}", format);
        String result = knowledgeGraphService.executeSparqlConstruct(request.getQuery(), format);
        return ResponseEntity.ok()
                .contentType(getMediaTypeForFormat(format))
                .body(result);
    }

    // Ontology Management
    @PostMapping("/ontologies")
    @Operation(summary = "Load an ontology into the knowledge graph")
    public ResponseEntity<OntologyResponse> loadOntology(@Valid @RequestBody OntologyRequest request) {
        log.info("Loading ontology: {}", request.getUri());
        OntologyResponse response = ontologyService.loadOntology(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/ontologies")
    @Operation(summary = "List loaded ontologies")
    public ResponseEntity<List<OntologyInfo>> listOntologies() {
        List<OntologyInfo> ontologies = ontologyService.listOntologies();
        return ResponseEntity.ok(ontologies);
    }

    @GetMapping("/ontologies/{id}/classes")
    @Operation(summary = "Get classes from an ontology")
    public ResponseEntity<List<OntologyClass>> getOntologyClasses(@PathVariable String id) {
        List<OntologyClass> classes = ontologyService.getOntologyClasses(id);
        return ResponseEntity.ok(classes);
    }

    @GetMapping("/ontologies/{id}/properties")
    @Operation(summary = "Get properties from an ontology")
    public ResponseEntity<List<OntologyProperty>> getOntologyProperties(@PathVariable String id) {
        List<OntologyProperty> properties = ontologyService.getOntologyProperties(id);
        return ResponseEntity.ok(properties);
    }

    // Reasoning Operations
    @PostMapping("/reasoning/infer")
    @Operation(summary = "Perform reasoning and infer new triples")
    public ResponseEntity<InferenceResponse> performInference(@Valid @RequestBody InferenceRequest request) {
        log.info("Performing inference with rules: {}", request.getRules().size());
        InferenceResponse response = reasoningService.performInference(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reasoning/validate")
    @Operation(summary = "Validate data against ontology constraints")
    public ResponseEntity<ValidationResponse> validateData(@Valid @RequestBody ValidationRequest request) {
        log.info("Validating data against ontology: {}", request.getOntologyUri());
        ValidationResponse response = reasoningService.validateData(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reasoning/consistency")
    @Operation(summary = "Check consistency of the knowledge graph")
    public ResponseEntity<ConsistencyResponse> checkConsistency() {
        log.info("Checking knowledge graph consistency");
        ConsistencyResponse response = reasoningService.checkConsistency();
        return ResponseEntity.ok(response);
    }

    // Entity Operations
    @PostMapping("/entities")
    @Operation(summary = "Create an entity with properties")
    public ResponseEntity<EntityResponse> createEntity(@Valid @RequestBody EntityRequest request) {
        log.info("Creating entity: {}", request.getUri());
        EntityResponse response = knowledgeGraphService.createEntity(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/entities/{uri}")
    @Operation(summary = "Get entity details")
    public ResponseEntity<EntityDetails> getEntity(@PathVariable String uri) {
        log.info("Getting entity: {}", uri);
        EntityDetails details = knowledgeGraphService.getEntity(uri);
        return ResponseEntity.ok(details);
    }

    @PutMapping("/entities/{uri}")
    @Operation(summary = "Update entity properties")
    public ResponseEntity<EntityResponse> updateEntity(
            @PathVariable String uri,
            @Valid @RequestBody EntityUpdateRequest request) {
        log.info("Updating entity: {}", uri);
        EntityResponse response = knowledgeGraphService.updateEntity(uri, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/entities/{uri}")
    @Operation(summary = "Delete an entity")
    public ResponseEntity<Void> deleteEntity(@PathVariable String uri) {
        log.info("Deleting entity: {}", uri);
        knowledgeGraphService.deleteEntity(uri);
        return ResponseEntity.noContent().build();
    }

    // Graph Analysis
    @GetMapping("/analysis/statistics")
    @Operation(summary = "Get knowledge graph statistics")
    public ResponseEntity<GraphStatistics> getStatistics() {
        GraphStatistics stats = knowledgeGraphService.getStatistics();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/analysis/connected")
    @Operation(summary = "Find connected entities")
    public ResponseEntity<List<String>> findConnectedEntities(
            @RequestParam String uri,
            @RequestParam(defaultValue = "3") int maxDistance) {
        List<String> connected = knowledgeGraphService.findConnectedEntities(uri, maxDistance);
        return ResponseEntity.ok(connected);
    }

    @GetMapping("/analysis/path")
    @Operation(summary = "Find path between two entities")
    public ResponseEntity<PathResponse> findPath(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(defaultValue = "10") int maxLength) {
        PathResponse path = knowledgeGraphService.findPath(from, to, maxLength);
        return ResponseEntity.ok(path);
    }

    // Export/Import
    @GetMapping("/export")
    @Operation(summary = "Export knowledge graph in various formats")
    public ResponseEntity<String> exportGraph(
            @RequestParam(defaultValue = "TURTLE") String format,
            @RequestParam(required = false) String graphUri) {
        String exported = knowledgeGraphService.exportGraph(format, graphUri);
        return ResponseEntity.ok()
                .contentType(getMediaTypeForFormat(format))
                .body(exported);
    }

    @PostMapping("/import")
    @Operation(summary = "Import RDF data into the knowledge graph")
    public ResponseEntity<ImportResponse> importData(
            @RequestBody String data,
            @RequestParam(defaultValue = "TURTLE") String format,
            @RequestParam(required = false) String graphUri) {
        log.info("Importing data in format: {}", format);
        ImportResponse response = knowledgeGraphService.importData(data, format, graphUri);
        return ResponseEntity.ok(response);
    }

    private MediaType getMediaTypeForFormat(String format) {
        switch (format.toUpperCase()) {
            case "JSON-LD":
                return MediaType.APPLICATION_JSON;
            case "RDF/XML":
                return MediaType.APPLICATION_XML;
            case "TURTLE":
            case "TTL":
                return MediaType.parseMediaType("text/turtle");
            case "N3":
                return MediaType.parseMediaType("text/n3");
            default:
                return MediaType.TEXT_PLAIN;
        }
    }
}