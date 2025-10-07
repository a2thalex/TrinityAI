package com.trinityai.knowledgegraph.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class SparqlQueryRequest {
    @NotBlank(message = "Query is required")
    @Size(min = 10, max = 10000, message = "Query must be between 10 and 10000 characters")
    private String query;

    private Integer limit;
    private Integer offset;
    private Integer timeout; // in seconds

    // Optional reasoning configuration
    private boolean enableReasoning = false;
    private String reasonerType; // OWL, RDFS, etc.
}