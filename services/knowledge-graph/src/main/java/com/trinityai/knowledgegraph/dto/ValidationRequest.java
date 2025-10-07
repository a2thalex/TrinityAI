package com.trinityai.knowledgegraph.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

@Data
public class ValidationRequest {
    // What to validate
    private ValidationScope scope = ValidationScope.FULL;
    private String graphUri; // Specific graph to validate
    private List<Triple> triplesToValidate; // Specific triples

    // Validation against ontology
    @NotNull(message = "Ontology URI is required for validation")
    private String ontologyUri;
    private List<String> additionalOntologies;

    // Validation rules
    private ValidationRules rules;

    // Options
    private boolean stopOnFirstError = false;
    private Integer maxErrors = 100;
    private boolean includeWarnings = true;
    private boolean suggestFixes = true;

    public enum ValidationScope {
        FULL,           // Validate entire graph
        GRAPH,          // Validate specific named graph
        TRIPLES,        // Validate specific triples
        INCREMENTAL     // Validate only recent changes
    }

    @Data
    public static class ValidationRules {
        // Structural validation
        private boolean checkDomainRange = true;
        private boolean checkCardinality = true;
        private boolean checkDisjointness = true;
        private boolean checkFunctionalProperties = true;
        private boolean checkInverseFunctionalProperties = true;

        // Type validation
        private boolean checkTypes = true;
        private boolean checkDatatypes = true;
        private boolean checkLiterals = true;

        // Constraint validation
        private boolean checkPropertyRestrictions = true;
        private boolean checkValueRestrictions = true;
        private boolean checkPatterns = true;

        // Consistency validation
        private boolean checkConsistency = true;
        private boolean checkCycles = true;
        private boolean checkOrphans = true;

        // Custom SHACL shapes
        private List<String> shaclShapes;

        // Custom SPARQL constraints
        private List<SparqlConstraint> sparqlConstraints;
    }

    @Data
    public static class SparqlConstraint {
        private String name;
        private String description;
        private String query; // ASK or SELECT query
        private String severity; // ERROR, WARNING, INFO
        private String message; // Error message template
    }
}