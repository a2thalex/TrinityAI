package com.trinityai.knowledgegraph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsistencyResponse {
    private boolean isConsistent;
    private String message;

    // Inconsistency details
    private Integer inconsistencyCount;
    private List<Inconsistency> inconsistencies;

    // Analysis results
    private Integer triplesAnalyzed;
    private Integer entitiesAnalyzed;
    private Integer ontologiesChecked;

    // Performance
    private Long checkTime; // milliseconds
    private String reasonerUsed;

    // Summary
    private Map<String, Integer> inconsistenciesByType;
    private Map<String, List<String>> affectedOntologies;

    // Recommendations
    private List<String> recommendations;
    private boolean canAutoFix;
    private List<AutoFix> availableFixes;

    private String error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Inconsistency {
        private String id;
        private String type; // LOGICAL, STRUCTURAL, SEMANTIC, CONSTRAINT
        private String severity; // CRITICAL, HIGH, MEDIUM, LOW
        private String description;

        // Specific inconsistency types
        private InconsistencySubtype subtype;

        // Involved elements
        private List<Triple> involvedTriples;
        private List<String> involvedEntities;
        private List<String> involvedClasses;
        private List<String> involvedProperties;

        // Explanation
        private String explanation;
        private List<String> derivationPath; // How the inconsistency was derived
        private String ontologySource; // Which ontology rule caused this

        // Impact
        private Integer impactedTriples;
        private List<String> impactedQueries; // Queries that might fail

        // Fix information
        private boolean isFixable;
        private String fixStrategy;
    }

    public enum InconsistencySubtype {
        // Logical inconsistencies
        CLASS_DISJOINTNESS,
        INDIVIDUAL_DISJOINTNESS,
        PROPERTY_DISJOINTNESS,
        CONTRADICTORY_ASSERTIONS,
        UNSATISFIABLE_CLASS,

        // Cardinality violations
        MIN_CARDINALITY_VIOLATION,
        MAX_CARDINALITY_VIOLATION,
        EXACT_CARDINALITY_VIOLATION,
        FUNCTIONAL_PROPERTY_VIOLATION,

        // Type violations
        DOMAIN_VIOLATION,
        RANGE_VIOLATION,
        DATATYPE_VIOLATION,

        // Structural issues
        CYCLIC_HIERARCHY,
        ORPHANED_ENTITY,
        UNDEFINED_REFERENCE,
        DUPLICATE_DEFINITION,

        // Semantic issues
        INCOMPATIBLE_PROPERTIES,
        CONFLICTING_VALUES,
        TEMPORAL_INCONSISTENCY
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AutoFix {
        private String inconsistencyId;
        private String fixName;
        private String description;
        private List<Triple> triplesToRemove;
        private List<Triple> triplesToAdd;
        private List<Triple> triplesToModify;
        private Double confidence; // 0.0 to 1.0
        private String impact; // Description of what this fix will change
        private boolean requiresConfirmation;
    }
}