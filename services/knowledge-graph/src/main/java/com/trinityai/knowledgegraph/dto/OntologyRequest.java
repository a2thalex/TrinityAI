package com.trinityai.knowledgegraph.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;

@Data
public class OntologyRequest {
    @NotBlank(message = "Ontology URI is required")
    @Pattern(regexp = "^https?://.*", message = "URI must be a valid HTTP(S) URL")
    private String uri;

    private String name;
    private String description;
    private String version;

    // Loading options
    private String format; // RDF/XML, TURTLE, N3, etc.
    private boolean loadImports = true; // Load imported ontologies
    private boolean enableReasoning = true;
    private String reasonerType = "OWL"; // OWL, RDFS, Custom

    // Validation options
    private boolean validateOnLoad = true;
    private boolean checkConsistency = true;

    // Source can be URL or inline content
    private String sourceType = "URL"; // URL or INLINE
    private String content; // For inline ontology content
}