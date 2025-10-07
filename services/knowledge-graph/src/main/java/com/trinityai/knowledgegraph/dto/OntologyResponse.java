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
public class OntologyResponse {
    private boolean success;
    private String message;
    private String ontologyUri;
    private String name;
    private String version;

    // Ontology statistics
    private Integer classCount;
    private Integer propertyCount;
    private Integer individualCount;
    private Integer axiomCount;

    // Import information
    private List<String> importedOntologies;
    private Map<String, String> namespaces;

    // Validation results
    private boolean isConsistent;
    private List<String> validationErrors;
    private List<String> warnings;

    private String error;
    private Long loadTime; // in milliseconds
}