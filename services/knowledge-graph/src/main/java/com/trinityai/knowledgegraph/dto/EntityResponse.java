package com.trinityai.knowledgegraph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntityResponse {
    private boolean success;
    private String message;
    private String uri;
    private String operation; // CREATE, UPDATE, DELETE

    // Entity information
    private String label;
    private String type;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;

    // Statistics
    private Integer propertiesAdded;
    private Integer propertiesModified;
    private Integer propertiesRemoved;
    private Integer relationsAdded;
    private Integer relationsRemoved;

    // Validation results
    private boolean isValid;
    private String validationMessage;

    private String error;
}