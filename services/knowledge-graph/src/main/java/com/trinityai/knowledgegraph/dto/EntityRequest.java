package com.trinityai.knowledgegraph.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import java.util.Map;
import java.util.List;

@Data
public class EntityRequest {
    @NotBlank(message = "Entity URI is required")
    @Pattern(regexp = "^https?://.*", message = "URI must be a valid HTTP(S) URL")
    private String uri;

    private String label;
    private String description;
    private String type; // RDF type (class URI)
    private List<String> additionalTypes; // Multiple types

    // Properties as key-value pairs
    private Map<String, Object> properties;

    // Relations to other entities
    private List<EntityRelation> relations;

    // Metadata
    private Map<String, String> metadata;

    // Validation
    private boolean validateAgainstOntology = true;
    private String ontologyUri; // Ontology to validate against

    @Data
    public static class EntityRelation {
        private String predicate; // Property URI
        private String objectUri; // Target entity URI
        private String objectType; // Optional: expected type of target
    }
}