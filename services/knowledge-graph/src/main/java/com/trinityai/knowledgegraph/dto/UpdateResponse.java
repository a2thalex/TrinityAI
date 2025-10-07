package com.trinityai.knowledgegraph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateResponse {
    private boolean success;
    private String message;
    private Integer triplesAdded;
    private Integer triplesRemoved;
    private Integer triplesModified;
    private Long executionTime; // in milliseconds
    private String graphUri;
    private String error;
    private String transactionId;
}