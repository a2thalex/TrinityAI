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
public class ValidationResponse {
    private boolean isValid;
    private String message;

    // Validation results
    private Integer errorCount;
    private Integer warningCount;
    private Integer infoCount;

    private List<ValidationIssue> errors;
    private List<ValidationIssue> warnings;
    private List<ValidationIssue> infos;

    // Statistics
    private Integer triplesValidated;
    private Integer entitiesValidated;
    private Long validationTime; // milliseconds

    // Summary by type
    private Map<String, Integer> issuesByType;
    private Map<String, Integer> issuesBySeverity;

    // Suggested fixes
    private List<SuggestedFix> suggestedFixes;

    private String error; // System error if validation fails

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationIssue {
        private String id;
        private String severity; // ERROR, WARNING, INFO
        private String type; // DOMAIN_VIOLATION, RANGE_VIOLATION, CARDINALITY_VIOLATION, etc.
        private String message;
        private String details;

        // Location of issue
        private Triple affectedTriple;
        private String affectedEntity;
        private String affectedProperty;

        // Context
        private String ontologyRule; // Which ontology rule was violated
        private String constraint; // Specific constraint violated
        private List<Triple> relatedTriples;

        // Fix suggestion
        private String suggestedFix;
        private List<Triple> fixTriples; // Triples to add/remove/modify
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SuggestedFix {
        private String issueId;
        private String description;
        private FixType type;
        private List<Triple> triplesToAdd;
        private List<Triple> triplesToRemove;
        private List<TripleModification> triplesToModify;
        private Double confidence; // 0.0 to 1.0
        private String rationale;

        public enum FixType {
            ADD_TRIPLE,
            REMOVE_TRIPLE,
            MODIFY_TRIPLE,
            ADD_TYPE,
            CHANGE_PROPERTY,
            CHANGE_VALUE,
            ADD_CONSTRAINT,
            BATCH_FIX
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TripleModification {
        private Triple original;
        private Triple modified;
        private String changeType; // SUBJECT, PREDICATE, OBJECT
    }
}