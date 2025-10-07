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
public class SparqlResponse {
    private boolean success;
    private String queryType; // SELECT, ASK, CONSTRUCT, DESCRIBE

    // For SELECT queries
    private List<String> variables;
    private List<Map<String, Object>> results;
    private Integer resultCount;

    // For ASK queries
    private Boolean booleanResult;

    // For CONSTRUCT/DESCRIBE queries
    private String graphData;
    private String format; // TURTLE, RDF/XML, JSON-LD, etc.

    // Execution metadata
    private Long executionTime; // in milliseconds
    private String error;

    // Pagination info
    private Integer limit;
    private Integer offset;
    private Boolean hasMore;
}