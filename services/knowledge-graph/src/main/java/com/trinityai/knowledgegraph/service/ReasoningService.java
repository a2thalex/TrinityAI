package com.trinityai.knowledgegraph.service;

import com.trinityai.knowledgegraph.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.ontology.*;
import org.apache.jena.query.*;
import org.apache.jena.rdf.model.*;
import org.apache.jena.rdfconnection.RDFConnection;
import org.apache.jena.reasoner.*;
import org.apache.jena.reasoner.rulesys.*;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.vocabulary.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for reasoning and inference operations on the knowledge graph
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReasoningService {

    private final RDFConnection rdfConnection;
    private final Model defaultModel;

    /**
     * Perform inference on the knowledge graph
     */
    public InferenceResponse performInference(InferenceRequest request) {
        long startTime = System.currentTimeMillis();
        InferenceResponse.InferenceResponseBuilder response = InferenceResponse.builder();

        try {
            // Get or create the base model
            Model baseModel = getModelForInference(request.getGraphUri());
            int triplesBefore = baseModel.size();

            // Create reasoner based on type
            Reasoner reasoner = createReasoner(request);

            // Add custom rules if provided
            if (request.getRules() != null && !request.getRules().isEmpty() && reasoner instanceof GenericRuleReasoner) {
                List<Rule> customRules = createCustomRules(request.getRules());
                ((GenericRuleReasoner) reasoner).addRules(customRules);
            }

            // Create inference model
            InfModel infModel = ModelFactory.createInfModel(reasoner, baseModel);

            // Perform inference
            infModel.prepare();

            // Count inferred triples
            int triplesAfter = infModel.size();
            int inferredCount = triplesAfter - triplesBefore;

            // Collect inferred triples (limited sample)
            List<Triple> inferredTriples = new ArrayList<>();
            List<InferenceResponse.InferenceExplanation> explanations = new ArrayList<>();

            if (inferredCount > 0) {
                StmtIterator stmts = infModel.listStatements();
                int sampleCount = 0;
                while (stmts.hasNext() && sampleCount < 100) {
                    Statement stmt = stmts.nextStatement();

                    // Check if this is an inferred statement
                    if (!baseModel.contains(stmt)) {
                        Triple triple = Triple.builder()
                                .subject(stmt.getSubject().toString())
                                .predicate(stmt.getPredicate().toString())
                                .objectUri(stmt.getObject().isResource() ? stmt.getObject().asResource().toString() : null)
                                .objectLiteral(stmt.getObject().isLiteral() ? stmt.getObject().asLiteral().toString() : null)
                                .build();
                        inferredTriples.add(triple);

                        // Add explanation if requested
                        if (request.isExplainInferences() && infModel.getDerivation(stmt) != null) {
                            InferenceResponse.InferenceExplanation explanation = createExplanation(stmt, infModel);
                            explanations.add(explanation);
                        }

                        sampleCount++;
                    }
                }
            }

            // Check for conflicts
            ValidityReport validity = infModel.validate();
            boolean hasConflicts = !validity.isValid();
            List<InferenceResponse.Conflict> conflicts = new ArrayList<>();

            if (hasConflicts) {
                validity.getReports().forEachRemaining(report -> {
                    if (report.isError) {
                        InferenceResponse.Conflict conflict = InferenceResponse.Conflict.builder()
                                .conflictType(report.type)
                                .description(report.description)
                                .build();
                        conflicts.add(conflict);
                    }
                });
            }

            // Materialize inferences if requested
            if (request.isMaterializeInferences() && inferredCount > 0) {
                // Add inferred triples to the base model
                baseModel.add(infModel.getDeductionsModel());

                // Save to Fuseki
                if (request.getGraphUri() != null) {
                    rdfConnection.load(request.getGraphUri(), infModel.getDeductionsModel());
                } else {
                    rdfConnection.load(infModel.getDeductionsModel());
                }
            }

            // Build response
            response.success(true)
                    .message(String.format("Inference completed. %d new triples inferred.", inferredCount))
                    .inferredTripleCount(inferredCount)
                    .inferredTriples(inferredTriples)
                    .explanations(explanations)
                    .totalTriplesBefore(triplesBefore)
                    .totalTriplesAfter(triplesAfter)
                    .hasConflicts(hasConflicts)
                    .conflicts(conflicts)
                    .isConsistent(!hasConflicts)
                    .reasonerUsed(request.getReasonerType().toString())
                    .inferenceTime(System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.error("Error performing inference: {}", e.getMessage(), e);
            response.success(false)
                    .error(e.getMessage())
                    .inferenceTime(System.currentTimeMillis() - startTime);
        }

        return response.build();
    }

    /**
     * Validate data against ontology constraints
     */
    public ValidationResponse validateData(ValidationRequest request) {
        long startTime = System.currentTimeMillis();
        ValidationResponse.ValidationResponseBuilder response = ValidationResponse.builder();

        try {
            // Get the model to validate
            Model dataModel = getModelForValidation(request);

            // Get the ontology model
            OntModel ontModel = loadOntologyForValidation(request.getOntologyUri());

            // Create reasoner for validation
            Reasoner reasoner = ReasonerRegistry.getOWLReasoner();
            reasoner = reasoner.bindSchema(ontModel);

            // Create inference model for validation
            InfModel infModel = ModelFactory.createInfModel(reasoner, dataModel);

            // Perform validation
            ValidityReport validity = infModel.validate();
            boolean isValid = validity.isValid();

            List<ValidationResponse.ValidationIssue> errors = new ArrayList<>();
            List<ValidationResponse.ValidationIssue> warnings = new ArrayList<>();
            int errorCount = 0;
            int warningCount = 0;

            validity.getReports().forEachRemaining(report -> {
                ValidationResponse.ValidationIssue issue = ValidationResponse.ValidationIssue.builder()
                        .id(UUID.randomUUID().toString())
                        .severity(report.isError ? "ERROR" : "WARNING")
                        .type(mapValidationType(report.type))
                        .message(report.description)
                        .build();

                if (report.isError) {
                    errors.add(issue);
                } else {
                    warnings.add(issue);
                }
            });

            errorCount = errors.size();
            warningCount = warnings.size();

            // Additional validation based on rules
            if (request.getRules() != null) {
                performCustomValidation(request.getRules(), dataModel, ontModel, errors, warnings);
                errorCount = errors.size();
                warningCount = warnings.size();
            }

            // Generate suggested fixes if requested
            List<ValidationResponse.SuggestedFix> fixes = new ArrayList<>();
            if (request.isSuggestFixes() && !errors.isEmpty()) {
                fixes = generateSuggestedFixes(errors, dataModel, ontModel);
            }

            response.isValid(isValid)
                    .message(isValid ? "Data is valid" : String.format("Validation failed with %d errors", errorCount))
                    .errorCount(errorCount)
                    .warningCount(warningCount)
                    .errors(errors)
                    .warnings(warnings)
                    .triplesValidated(dataModel.size())
                    .suggestedFixes(fixes)
                    .validationTime(System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.error("Error validating data: {}", e.getMessage(), e);
            response.isValid(false)
                    .error(e.getMessage())
                    .validationTime(System.currentTimeMillis() - startTime);
        }

        return response.build();
    }

    /**
     * Check consistency of the knowledge graph
     */
    public ConsistencyResponse checkConsistency() {
        long startTime = System.currentTimeMillis();
        ConsistencyResponse.ConsistencyResponseBuilder response = ConsistencyResponse.builder();

        try {
            // Get the entire graph
            Model model = defaultModel;

            // Create OWL reasoner for consistency checking
            Reasoner reasoner = ReasonerRegistry.getOWLReasoner();
            InfModel infModel = ModelFactory.createInfModel(reasoner, model);

            // Perform consistency check
            ValidityReport validity = infModel.validate();
            boolean isConsistent = validity.isValid();

            List<ConsistencyResponse.Inconsistency> inconsistencies = new ArrayList<>();
            int inconsistencyCount = 0;

            if (!isConsistent) {
                validity.getReports().forEachRemaining(report -> {
                    if (report.isError) {
                        ConsistencyResponse.Inconsistency inconsistency = ConsistencyResponse.Inconsistency.builder()
                                .id(UUID.randomUUID().toString())
                                .type("LOGICAL")
                                .severity(getSeverity(report.type))
                                .description(report.description)
                                .subtype(mapInconsistencyType(report.type))
                                .explanation(report.description)
                                .isFixable(isFixable(report.type))
                                .build();
                        inconsistencies.add(inconsistency);
                    }
                });
                inconsistencyCount = inconsistencies.size();
            }

            // Additional consistency checks
            performStructuralConsistencyChecks(model, inconsistencies);
            inconsistencyCount = inconsistencies.size();

            // Generate recommendations
            List<String> recommendations = generateRecommendations(inconsistencies);

            // Check if auto-fix is possible
            boolean canAutoFix = inconsistencies.stream()
                    .anyMatch(i -> i.isFixable());

            response.isConsistent(isConsistent)
                    .message(isConsistent ? "Knowledge graph is consistent" :
                            String.format("Found %d inconsistencies", inconsistencyCount))
                    .inconsistencyCount(inconsistencyCount)
                    .inconsistencies(inconsistencies)
                    .triplesAnalyzed(model.size())
                    .reasonerUsed("OWL Reasoner")
                    .recommendations(recommendations)
                    .canAutoFix(canAutoFix)
                    .checkTime(System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.error("Error checking consistency: {}", e.getMessage(), e);
            response.isConsistent(false)
                    .error(e.getMessage())
                    .checkTime(System.currentTimeMillis() - startTime);
        }

        return response.build();
    }

    private Reasoner createReasoner(InferenceRequest request) {
        switch (request.getReasonerType()) {
            case OWL:
                return ReasonerRegistry.getOWLReasoner();
            case RDFS:
                return ReasonerRegistry.getRDFSReasoner();
            case OWL_MICRO:
                return ReasonerRegistry.getOWLMicroReasoner();
            case OWL_MINI:
                return ReasonerRegistry.getOWLMiniReasoner();
            case TRANSITIVE:
                return ReasonerRegistry.getTransitiveReasoner();
            case RULE_BASED:
                List<Rule> rules = new ArrayList<>();
                if (request.getRules() != null) {
                    rules = createCustomRules(request.getRules());
                }
                return new GenericRuleReasoner(rules);
            default:
                return ReasonerRegistry.getOWLReasoner();
        }
    }

    private List<Rule> createCustomRules(List<InferenceRequest.InferenceRule> inferenceRules) {
        List<Rule> rules = new ArrayList<>();
        for (InferenceRequest.InferenceRule ir : inferenceRules) {
            if (ir.isEnabled()) {
                try {
                    // Simple rule parsing - in production, use a proper parser
                    Rule rule = Rule.parseRule(ir.getName() + ": " + ir.getCondition() + " -> " + ir.getConclusion());
                    rules.add(rule);
                } catch (Exception e) {
                    log.warn("Could not parse rule: {}", ir.getName(), e);
                }
            }
        }
        return rules;
    }

    private Model getModelForInference(String graphUri) {
        if (graphUri != null) {
            // Query specific graph from Fuseki
            String query = String.format("CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <%s> { ?s ?p ?o } }", graphUri);
            Model model = ModelFactory.createDefaultModel();
            try (QueryExecution qexec = rdfConnection.query(query)) {
                model = qexec.execConstruct();
            }
            return model;
        } else {
            return defaultModel;
        }
    }

    private Model getModelForValidation(ValidationRequest request) {
        Model model = ModelFactory.createDefaultModel();

        if (request.getScope() == ValidationRequest.ValidationScope.TRIPLES &&
            request.getTriplesToValidate() != null) {
            // Create model from specific triples
            for (Triple triple : request.getTriplesToValidate()) {
                Resource subject = model.createResource(triple.getSubject());
                Property predicate = model.createProperty(triple.getPredicate());

                if (triple.getObjectUri() != null) {
                    Resource object = model.createResource(triple.getObjectUri());
                    model.add(subject, predicate, object);
                } else if (triple.getObjectLiteral() != null) {
                    Literal literal = model.createLiteral(triple.getObjectLiteral());
                    model.add(subject, predicate, literal);
                }
            }
        } else if (request.getGraphUri() != null) {
            return getModelForInference(request.getGraphUri());
        } else {
            return defaultModel;
        }

        return model;
    }

    private OntModel loadOntologyForValidation(String ontologyUri) {
        OntModel ontModel = ModelFactory.createOntologyModel(OntModelSpec.OWL_MEM);
        ontModel.read(ontologyUri);
        return ontModel;
    }

    private InferenceResponse.InferenceExplanation createExplanation(Statement stmt, InfModel infModel) {
        Derivation deriv = infModel.getDerivation(stmt);
        InferenceResponse.InferenceExplanation.InferenceExplanationBuilder explanation =
                InferenceResponse.InferenceExplanation.builder();

        Triple inferredTriple = Triple.builder()
                .subject(stmt.getSubject().toString())
                .predicate(stmt.getPredicate().toString())
                .objectUri(stmt.getObject().isResource() ? stmt.getObject().asResource().toString() : null)
                .objectLiteral(stmt.getObject().isLiteral() ? stmt.getObject().asLiteral().toString() : null)
                .build();

        explanation.inferredTriple(inferredTriple);

        if (deriv != null) {
            explanation.inferenceType(deriv.toString());
            // Additional derivation details could be extracted here
        }

        return explanation.build();
    }

    private String mapValidationType(String type) {
        if (type == null) return "UNKNOWN";
        if (type.contains("domain")) return "DOMAIN_VIOLATION";
        if (type.contains("range")) return "RANGE_VIOLATION";
        if (type.contains("cardinality")) return "CARDINALITY_VIOLATION";
        if (type.contains("disjoint")) return "DISJOINT_VIOLATION";
        if (type.contains("functional")) return "FUNCTIONAL_PROPERTY_VIOLATION";
        return type.toUpperCase();
    }

    private ConsistencyResponse.InconsistencySubtype mapInconsistencyType(String type) {
        if (type == null) return ConsistencyResponse.InconsistencySubtype.CONTRADICTORY_ASSERTIONS;
        if (type.contains("disjoint")) return ConsistencyResponse.InconsistencySubtype.CLASS_DISJOINTNESS;
        if (type.contains("cardinality")) return ConsistencyResponse.InconsistencySubtype.MAX_CARDINALITY_VIOLATION;
        if (type.contains("functional")) return ConsistencyResponse.InconsistencySubtype.FUNCTIONAL_PROPERTY_VIOLATION;
        if (type.contains("domain")) return ConsistencyResponse.InconsistencySubtype.DOMAIN_VIOLATION;
        if (type.contains("range")) return ConsistencyResponse.InconsistencySubtype.RANGE_VIOLATION;
        return ConsistencyResponse.InconsistencySubtype.CONTRADICTORY_ASSERTIONS;
    }

    private String getSeverity(String type) {
        if (type == null) return "MEDIUM";
        if (type.contains("disjoint") || type.contains("contradiction")) return "CRITICAL";
        if (type.contains("cardinality") || type.contains("functional")) return "HIGH";
        if (type.contains("domain") || type.contains("range")) return "MEDIUM";
        return "LOW";
    }

    private boolean isFixable(String type) {
        // Simple heuristic - some types of inconsistencies can be auto-fixed
        return type != null && (type.contains("cardinality") || type.contains("duplicate"));
    }

    private void performCustomValidation(ValidationRequest.ValidationRules rules, Model dataModel,
                                        OntModel ontModel, List<ValidationResponse.ValidationIssue> errors,
                                        List<ValidationResponse.ValidationIssue> warnings) {
        // Custom validation logic based on rules
        // This would implement specific validation checks based on the rules configuration
    }

    private void performStructuralConsistencyChecks(Model model,
                                                   List<ConsistencyResponse.Inconsistency> inconsistencies) {
        // Check for orphaned entities
        String orphanQuery = "SELECT ?s WHERE { ?s ?p ?o . FILTER NOT EXISTS { ?s ?p2 ?o2 . FILTER(?p != ?p2) } }";

        try (QueryExecution qexec = QueryExecutionFactory.create(orphanQuery, model)) {
            ResultSet results = qexec.execSelect();
            while (results.hasNext()) {
                QuerySolution solution = results.nextSolution();
                Resource orphan = solution.getResource("s");

                ConsistencyResponse.Inconsistency inconsistency = ConsistencyResponse.Inconsistency.builder()
                        .id(UUID.randomUUID().toString())
                        .type("STRUCTURAL")
                        .severity("LOW")
                        .description("Orphaned entity: " + orphan.getURI())
                        .subtype(ConsistencyResponse.InconsistencySubtype.ORPHANED_ENTITY)
                        .isFixable(true)
                        .build();

                inconsistencies.add(inconsistency);
            }
        }
    }

    private List<ValidationResponse.SuggestedFix> generateSuggestedFixes(
            List<ValidationResponse.ValidationIssue> errors, Model dataModel, OntModel ontModel) {
        List<ValidationResponse.SuggestedFix> fixes = new ArrayList<>();

        for (ValidationResponse.ValidationIssue error : errors) {
            if ("DOMAIN_VIOLATION".equals(error.getType())) {
                // Generate fix for domain violation
                ValidationResponse.SuggestedFix fix = ValidationResponse.SuggestedFix.builder()
                        .issueId(error.getId())
                        .description("Add correct type assertion")
                        .type(ValidationResponse.SuggestedFix.FixType.ADD_TYPE)
                        .confidence(0.8)
                        .rationale("Adding the correct type will resolve the domain violation")
                        .build();
                fixes.add(fix);
            }
        }

        return fixes;
    }

    private List<String> generateRecommendations(List<ConsistencyResponse.Inconsistency> inconsistencies) {
        List<String> recommendations = new ArrayList<>();

        boolean hasDisjointness = inconsistencies.stream()
                .anyMatch(i -> i.getSubtype() == ConsistencyResponse.InconsistencySubtype.CLASS_DISJOINTNESS);

        if (hasDisjointness) {
            recommendations.add("Review class hierarchy for conflicting disjointness declarations");
        }

        boolean hasCardinality = inconsistencies.stream()
                .anyMatch(i -> i.getSubtype() == ConsistencyResponse.InconsistencySubtype.MAX_CARDINALITY_VIOLATION ||
                             i.getSubtype() == ConsistencyResponse.InconsistencySubtype.MIN_CARDINALITY_VIOLATION);

        if (hasCardinality) {
            recommendations.add("Check property cardinality constraints and adjust data accordingly");
        }

        if (inconsistencies.isEmpty()) {
            recommendations.add("Knowledge graph is consistent. Consider adding more validation rules for deeper checks.");
        }

        return recommendations;
    }
}