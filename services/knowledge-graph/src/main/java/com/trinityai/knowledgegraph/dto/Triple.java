package com.trinityai.knowledgegraph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.validation.constraints.NotBlank;

/**
 * RDF Triple representation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Triple {

    @NotBlank(message = "Subject URI is required")
    private String subject;

    @NotBlank(message = "Predicate URI is required")
    private String predicate;

    // Either objectUri or objectLiteral should be present
    private String objectUri;
    private String objectLiteral;
    private String objectDatatype;
    private String objectLanguage;
}