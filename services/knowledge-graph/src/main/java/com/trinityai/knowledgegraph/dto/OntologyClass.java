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
public class OntologyClass {
    private String uri;
    private String localName;
    private String namespace;
    private String label;
    private String comment;

    // Hierarchy
    private List<String> superClasses;
    private List<String> subClasses;
    private List<String> equivalentClasses;
    private List<String> disjointClasses;

    // Properties
    private List<String> domainOfProperties;
    private List<String> rangeOfProperties;

    // Restrictions
    private List<PropertyRestriction> restrictions;

    // Instances
    private Integer instanceCount;
    private List<String> sampleInstances; // Limited sample

    // Annotations
    private Map<String, Object> annotations;

    // Metadata
    private boolean isDeprecated;
    private String definedBy;
    private String seeAlso;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PropertyRestriction {
        private String property;
        private String type; // MIN_CARDINALITY, MAX_CARDINALITY, EXACT_CARDINALITY, SOME_VALUES_FROM, ALL_VALUES_FROM, HAS_VALUE
        private Object value;
        private String datatype;
    }
}