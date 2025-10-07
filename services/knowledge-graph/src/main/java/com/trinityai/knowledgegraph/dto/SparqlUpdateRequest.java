package com.trinityai.knowledgegraph.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class SparqlUpdateRequest {
    @NotBlank(message = "Update query is required")
    @Size(min = 10, max = 50000, message = "Update must be between 10 and 50000 characters")
    private String update;

    private String graphUri; // Target graph for update
    private boolean useTransaction = true;
    private Integer timeout; // in seconds

    // Optional validation
    private boolean validateBeforeUpdate = false;
    private boolean checkConstraints = true;
}