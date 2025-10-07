package com.trinityai.knowledgegraph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GraphStatistics {
    // Basic counts
    private Long totalTriples;
    private Long totalEntities; // Unique subjects
    private Long totalPredicates; // Unique predicates
    private Long totalClasses; // Unique types
    private Long totalLiterals;
    private Long totalBlankNodes;

    // Graph structure
    private Double averageDegree;
    private Integer maxDegree;
    private Integer minDegree;
    private Double density; // Actual edges / possible edges
    private Integer diameter; // Longest shortest path
    private Double clusteringCoefficient;
    private Integer connectedComponents;

    // By namespace
    private Map<String, Long> triplesByNamespace;
    private Map<String, Long> entitiesByNamespace;
    private Map<String, Long> predicatesByNamespace;

    // By type
    private Map<String, Long> entitiesByType;
    private Map<String, Long> topClasses; // Most used classes
    private Map<String, Long> topPredicates; // Most used predicates

    // Growth statistics
    private Long triplesAddedToday;
    private Long triplesAddedThisWeek;
    private Long triplesAddedThisMonth;
    private Double growthRate; // Triples per day average

    // Quality metrics
    private Double completeness; // Based on schema
    private Double consistency;
    private Integer orphanedEntities;
    private Integer danglingReferences;
    private Integer duplicateStatements;

    // Named graphs
    private Integer namedGraphCount;
    private Map<String, Long> triplesByGraph;
    private String largestGraph;
    private Long largestGraphSize;

    // Ontology statistics
    private Integer loadedOntologies;
    private Long ontologyTriples;
    private Long inferredTriples;
    private Double inferenceRatio; // Inferred / asserted

    // Performance metrics
    private Double averageQueryTime; // milliseconds
    private Long indexSize; // bytes
    private Long diskUsage; // bytes
    private Double cacheHitRate;

    // Time information
    private LocalDateTime lastUpdated;
    private LocalDateTime lastFullAnalysis;
    private Long analysisTime; // milliseconds

    // Distribution analysis
    private List<DegreeDistribution> degreeDistribution;
    private List<PredicateUsage> predicateUsage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DegreeDistribution {
        private Integer degree;
        private Long entityCount;
        private Double percentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PredicateUsage {
        private String predicate;
        private String label;
        private Long usageCount;
        private Double percentage;
        private List<String> topSubjectTypes;
        private List<String> topObjectTypes;
    }
}