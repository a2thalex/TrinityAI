package com.trinityai.knowledgegraph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportResponse {
    private boolean success;
    private String message;

    // Import statistics
    private Long triplesImported;
    private Long triplesSkipped;
    private Long triplesFailed;
    private Long totalTriples;

    // Entity breakdown
    private Long entitiesImported;
    private Long predicatesImported;
    private Long literalsImported;
    private Long blankNodesImported;

    // By type
    private Map<String, Long> triplesByPredicate;
    private Map<String, Long> entitiesByType;

    // Namespaces
    private List<String> namespacesDetected;
    private Map<String, String> namespaceMappings;

    // Validation results
    private boolean validationPerformed;
    private Integer validationErrors;
    private Integer validationWarnings;
    private List<ValidationError> errors;
    private List<ValidationError> warnings;

    // Duplicates handling
    private Long duplicatesFound;
    private String duplicateStrategy; // SKIP, OVERWRITE, MERGE
    private List<String> duplicateExamples;

    // Performance
    private Long importTime; // milliseconds
    private Double throughput; // triples per second
    private Long memoryUsed; // bytes

    // Transaction info
    private String transactionId;
    private boolean committed;
    private LocalDateTime importedAt;

    // Source information
    private String sourceFormat; // TURTLE, RDF/XML, JSON-LD, etc.
    private Long sourceSize; // bytes
    private String targetGraph;

    // Error details
    private String error;
    private String errorDetails;
    private Integer errorLine; // Line number where error occurred

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationError {
        private String type;
        private String severity;
        private String message;
        private Integer line;
        private String tripleText;
        private String suggestion;
    }
}