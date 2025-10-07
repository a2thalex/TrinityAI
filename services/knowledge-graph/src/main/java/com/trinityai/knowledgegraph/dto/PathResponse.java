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
public class PathResponse {
    private boolean found;
    private String message;

    // Path information
    private String sourceUri;
    private String sourceLabel;
    private String targetUri;
    private String targetLabel;

    // Path details
    private List<String> path; // Ordered list of entity URIs
    private List<PathSegment> segments; // Detailed path segments
    private Integer length; // Number of hops
    private Double weight; // Total weight/cost of path

    // Multiple paths (if requested)
    private List<PathInfo> alternativePaths;
    private Integer totalPathsFound;

    // Performance
    private Long searchTime; // milliseconds
    private Integer nodesExplored;
    private String algorithm; // BFS, DFS, Dijkstra, A*, etc.

    // Constraints applied
    private Integer maxLength;
    private List<String> allowedPredicates;
    private List<String> avoidedNodes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PathSegment {
        private String fromUri;
        private String fromLabel;
        private String fromType;

        private String predicate;
        private String predicateLabel;

        private String toUri;
        private String toLabel;
        private String toType;

        private Double weight; // Segment weight/cost
        private Map<String, Object> properties; // Additional edge properties
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PathInfo {
        private List<String> path;
        private List<PathSegment> segments;
        private Integer length;
        private Double weight;
        private Double similarity; // To primary path
        private String differenceDescription;
    }
}