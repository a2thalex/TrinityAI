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
public class OntologyInfo {
    private String id;
    private String uri;
    private String name;
    private String description;
    private String version;
    private String format;

    // Metadata
    private LocalDateTime loadedAt;
    private LocalDateTime lastModified;
    private String author;
    private String license;

    // Statistics
    private Integer classCount;
    private Integer objectPropertyCount;
    private Integer dataPropertyCount;
    private Integer individualCount;
    private Integer axiomCount;
    private Long tripleCount;

    // Namespaces and prefixes
    private Map<String, String> namespaces;
    private String defaultNamespace;

    // Dependencies
    private List<String> imports;
    private List<String> dependentOntologies;

    // Status
    private String status; // LOADED, LOADING, ERROR, VALIDATING
    private boolean isConsistent;
    private boolean hasReasoning;
}