package com.trinityai.knowledgegraph.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class EntityUpdateRequest {
    // Properties to add or update (will overwrite if exists)
    private Map<String, Object> addProperties;

    // Properties to remove (just the property URIs)
    private List<String> deleteProperties;

    // Specific property values to remove (property -> specific values)
    private Map<String, List<Object>> deletePropertyValues;

    // Relations to add
    private List<EntityRelation> addRelations;

    // Relations to remove
    private List<EntityRelation> deleteRelations;

    // Type changes
    private List<String> addTypes;
    private List<String> removeTypes;

    // Metadata updates
    private String newLabel;
    private String newDescription;
    private Map<String, String> updateMetadata;

    // Validation
    private boolean validateBeforeUpdate = true;
    private String ontologyUri;

    // Versioning
    private boolean createVersion = true;
    private String versionComment;

    // Options
    private boolean atomic = true; // All or nothing update
    private boolean cascade = false; // Update related entities

    @Data
    public static class EntityRelation {
        private String predicate;
        private String objectUri;
        private Map<String, Object> qualifiers; // For qualified relations
    }
}