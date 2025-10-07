package com.trinityai.knowledgegraph.dto;

import lombok.Data;
import javax.validation.Valid;
import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class TripleRequest {
    @NotEmpty(message = "At least one triple is required")
    @Valid
    private List<Triple> triples;

    private String graphUri;
}