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
public class OntologyProperty {
    private String uri;
    private String localName;
    private String namespace;
    private String label;
    private String comment;

    // Property type
    private PropertyType type; // OBJECT, DATATYPE, ANNOTATION

    // Hierarchy
    private List<String> superProperties;
    private List<String> subProperties;
    private List<String> equivalentProperties;
    private List<String> inverseProperties;

    // Domain and Range
    private List<String> domain; // Classes this property applies to
    private List<String> range;  // Classes or datatypes for values

    // Characteristics
    private boolean isFunctional;
    private boolean isInverseFunctional;
    private boolean isTransitive;
    private boolean isSymmetric;
    private boolean isAsymmetric;
    private boolean isReflexive;
    private boolean isIrreflexive;

    // Cardinality constraints
    private Integer minCardinality;
    private Integer maxCardinality;
    private Integer exactCardinality;

    // For datatype properties
    private String datatype;
    private String pattern;
    private Object minValue;
    private Object maxValue;

    // Usage statistics
    private Integer usageCount;
    private List<String> sampleUsages; // Limited sample

    // Annotations
    private Map<String, Object> annotations;

    // Metadata
    private boolean isDeprecated;
    private String definedBy;
    private String seeAlso;

    public enum PropertyType {
        OBJECT,
        DATATYPE,
        ANNOTATION
    }
}