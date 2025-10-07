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
public class EntityDetails {
    private String uri;
    private String label;
    private String description;
    private List<String> types; // All RDF types
    private String primaryType; // Main type

    // All properties grouped by predicate
    private Map<String, List<Object>> properties;

    // Relationships
    private List<EntityRelationship> outgoingRelations;
    private List<EntityRelationship> incomingRelations;

    // Hierarchy
    private List<String> parentEntities;
    private List<String> childEntities;

    // Metadata
    private LocalDateTime createdAt;
    private LocalDateTime lastModified;
    private String creator;
    private String lastModifiedBy;
    private Long version;

    // Statistics
    private Integer propertyCount;
    private Integer outgoingRelationCount;
    private Integer incomingRelationCount;
    private Integer tripleCount; // Total triples involving this entity

    // Provenance
    private String source;
    private String derivedFrom;
    private Map<String, String> provenance;

    // Quality metrics
    private Double completeness; // 0.0 to 1.0
    private Double consistency; // 0.0 to 1.0
    private LocalDateTime lastValidated;

    // Links
    private List<ExternalLink> externalLinks;
    private List<String> sameAs; // owl:sameAs links

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EntityRelationship {
        private String predicate;
        private String predicateLabel;
        private String targetUri;
        private String targetLabel;
        private String targetType;
        private Map<String, Object> qualifiers; // Additional properties of the relationship
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExternalLink {
        private String uri;
        private String type; // WIKIPEDIA, DBPEDIA, WIKIDATA, etc.
        private String label;
        private Double confidence;
    }
}