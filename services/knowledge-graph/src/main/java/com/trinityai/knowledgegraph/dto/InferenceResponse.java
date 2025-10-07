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
public class InferenceResponse {
    private boolean success;
    private String message;

    // Inference results
    private Integer inferredTripleCount;
    private List<Triple> inferredTriples; // Limited sample
    private List<InferenceExplanation> explanations;

    // Statistics
    private Integer totalTriplesBefore;
    private Integer totalTriplesAfter;
    private Integer iterations;
    private Long inferenceTime; // milliseconds

    // Conflicts and inconsistencies
    private boolean hasConflicts;
    private List<Conflict> conflicts;
    private boolean isConsistent;
    private List<String> inconsistencyReasons;

    // Metadata
    private String reasonerUsed;
    private Map<String, Integer> inferenceTypeCount; // Count by type (e.g., "subClassOf": 45)

    private String error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InferenceExplanation {
        private Triple inferredTriple;
        private String inferenceType;
        private List<Triple> premises; // Triples that led to this inference
        private String rule; // Rule or axiom used
        private String explanation; // Human-readable explanation
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Conflict {
        private Triple triple1;
        private Triple triple2;
        private String conflictType; // DISJOINT, CARDINALITY, FUNCTIONAL, etc.
        private String description;
        private String resolution; // Suggested resolution
    }
}