package com.trinityai.knowledgegraph.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

@Data
public class InferenceRequest {
    // Reasoning configuration
    @NotNull(message = "Reasoner type is required")
    private ReasonerType reasonerType = ReasonerType.OWL;

    // Custom rules (for rule-based reasoning)
    private List<InferenceRule> rules;

    // Scope of inference
    private String graphUri; // Specific graph to reason over
    private List<String> ontologyUris; // Ontologies to use for reasoning
    private boolean includeImports = true;

    // Control parameters
    private Integer maxIterations = 100;
    private Integer timeout = 60; // seconds
    private boolean explainInferences = false;
    private boolean materializeInferences = true; // Add inferred triples to graph

    // Specific inference types to perform
    private InferenceOptions options;

    // Filter for results
    private String filterPattern; // SPARQL pattern to filter results

    public enum ReasonerType {
        OWL,        // OWL reasoning
        RDFS,       // RDFS reasoning
        OWL_MICRO,  // OWL Micro reasoner
        OWL_MINI,   // OWL Mini reasoner
        TRANSITIVE, // Transitive reasoner
        RULE_BASED, // Custom rule-based
        PELLET,     // Pellet reasoner (if available)
        HERMIT      // HermiT reasoner (if available)
    }

    @Data
    public static class InferenceRule {
        private String name;
        private String description;
        private String condition; // SPARQL WHERE pattern
        private String conclusion; // SPARQL CONSTRUCT pattern
        private Integer priority = 0;
        private boolean enabled = true;
    }

    @Data
    public static class InferenceOptions {
        private boolean inferTypes = true;
        private boolean inferSubClasses = true;
        private boolean inferEquivalence = true;
        private boolean inferPropertyChains = true;
        private boolean inferInverseProperties = true;
        private boolean inferSymmetry = true;
        private boolean inferTransitivity = true;
        private boolean inferDisjointness = true;
        private boolean inferCardinality = true;
        private boolean inferDomainRange = true;
    }
}