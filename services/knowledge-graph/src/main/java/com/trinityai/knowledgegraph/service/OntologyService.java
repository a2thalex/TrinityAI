package com.trinityai.knowledgegraph.service;

import com.trinityai.knowledgegraph.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.ontology.*;
import org.apache.jena.rdf.model.*;
import org.apache.jena.rdfconnection.RDFConnection;
import org.apache.jena.reasoner.Reasoner;
import org.apache.jena.reasoner.ReasonerRegistry;
import org.apache.jena.reasoner.ValidityReport;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.util.iterator.ExtendedIterator;
import org.apache.jena.vocabulary.OWL;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.StringReader;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for managing ontologies in the knowledge graph
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OntologyService {

    private final RDFConnection rdfConnection;
    private final Map<String, OntModel> loadedOntologies = new ConcurrentHashMap<>();

    /**
     * Load an ontology into the knowledge graph
     */
    public OntologyResponse loadOntology(OntologyRequest request) {
        long startTime = System.currentTimeMillis();
        OntologyResponse.OntologyResponseBuilder response = OntologyResponse.builder()
                .ontologyUri(request.getUri())
                .name(request.getName());

        try {
            OntModel ontModel = ModelFactory.createOntologyModel(
                getOntologySpec(request.getReasonerType())
            );

            // Load the ontology
            if ("URL".equals(request.getSourceType())) {
                ontModel.read(request.getUri());
            } else if ("INLINE".equals(request.getSourceType()) && request.getContent() != null) {
                StringReader reader = new StringReader(request.getContent());
                ontModel.read(reader, request.getUri());
            }

            // Load imports if requested
            if (request.isLoadImports()) {
                ontModel.loadImports();
            }

            // Validate if requested
            List<String> validationErrors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            boolean isConsistent = true;

            if (request.isValidateOnLoad()) {
                ValidityReport validity = ontModel.validate();
                isConsistent = validity.isValid();

                validity.getReports().forEachRemaining(report -> {
                    String message = report.description;
                    if (report.isError) {
                        validationErrors.add(message);
                    } else {
                        warnings.add(message);
                    }
                });
            }

            // Store the ontology
            loadedOntologies.put(request.getUri(), ontModel);

            // Load into Fuseki
            rdfConnection.load(ontModel);

            // Gather statistics
            int classCount = countClasses(ontModel);
            int propertyCount = countProperties(ontModel);
            int individualCount = countIndividuals(ontModel);
            int axiomCount = ontModel.size();

            // Get imported ontologies
            List<String> imports = new ArrayList<>();
            ontModel.listImportedOntologyURIs().forEachRemaining(imports::add);

            // Get namespaces
            Map<String, String> namespaces = ontModel.getNsPrefixMap();

            response.success(true)
                    .message("Ontology loaded successfully")
                    .version(request.getVersion())
                    .classCount(classCount)
                    .propertyCount(propertyCount)
                    .individualCount(individualCount)
                    .axiomCount(axiomCount)
                    .importedOntologies(imports)
                    .namespaces(namespaces)
                    .isConsistent(isConsistent)
                    .validationErrors(validationErrors)
                    .warnings(warnings)
                    .loadTime(System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.error("Error loading ontology: {}", e.getMessage(), e);
            response.success(false)
                    .error(e.getMessage())
                    .loadTime(System.currentTimeMillis() - startTime);
        }

        return response.build();
    }

    /**
     * List all loaded ontologies
     */
    @Cacheable(value = "ontologies")
    public List<OntologyInfo> listOntologies() {
        List<OntologyInfo> ontologies = new ArrayList<>();

        for (Map.Entry<String, OntModel> entry : loadedOntologies.entrySet()) {
            String uri = entry.getKey();
            OntModel model = entry.getValue();

            OntologyInfo info = OntologyInfo.builder()
                    .uri(uri)
                    .id(uri.substring(uri.lastIndexOf("/") + 1))
                    .classCount(countClasses(model))
                    .objectPropertyCount(countObjectProperties(model))
                    .dataPropertyCount(countDataProperties(model))
                    .individualCount(countIndividuals(model))
                    .axiomCount(model.size())
                    .tripleCount((long) model.size())
                    .namespaces(model.getNsPrefixMap())
                    .status("LOADED")
                    .isConsistent(true)
                    .hasReasoning(model.getReasoner() != null)
                    .loadedAt(LocalDateTime.now())
                    .build();

            // Get imports
            List<String> imports = new ArrayList<>();
            model.listImportedOntologyURIs().forEachRemaining(imports::add);
            info.setImports(imports);

            ontologies.add(info);
        }

        return ontologies;
    }

    /**
     * Get classes from an ontology
     */
    @Cacheable(value = "ontologyClasses", key = "#ontologyId")
    public List<OntologyClass> getOntologyClasses(String ontologyId) {
        OntModel model = loadedOntologies.get(ontologyId);
        if (model == null) {
            log.warn("Ontology not found: {}", ontologyId);
            return Collections.emptyList();
        }

        List<OntologyClass> classes = new ArrayList<>();

        ExtendedIterator<OntClass> classIter = model.listClasses();
        while (classIter.hasNext()) {
            OntClass ontClass = classIter.next();

            // Skip anonymous classes
            if (ontClass.isAnon()) continue;

            OntologyClass classInfo = OntologyClass.builder()
                    .uri(ontClass.getURI())
                    .localName(ontClass.getLocalName())
                    .namespace(ontClass.getNameSpace())
                    .label(getLabel(ontClass))
                    .comment(getComment(ontClass))
                    .build();

            // Get superclasses
            List<String> superClasses = new ArrayList<>();
            ontClass.listSuperClasses(true).forEachRemaining(sc -> {
                if (!sc.isAnon()) {
                    superClasses.add(sc.getURI());
                }
            });
            classInfo.setSuperClasses(superClasses);

            // Get subclasses
            List<String> subClasses = new ArrayList<>();
            ontClass.listSubClasses(true).forEachRemaining(sc -> {
                if (!sc.isAnon()) {
                    subClasses.add(sc.getURI());
                }
            });
            classInfo.setSubClasses(subClasses);

            // Get equivalent classes
            List<String> equivalentClasses = new ArrayList<>();
            ontClass.listEquivalentClasses().forEachRemaining(ec -> {
                if (!ec.isAnon() && !ec.equals(ontClass)) {
                    equivalentClasses.add(ec.getURI());
                }
            });
            classInfo.setEquivalentClasses(equivalentClasses);

            // Get disjoint classes
            List<String> disjointClasses = new ArrayList<>();
            ontClass.listDisjointWith().forEachRemaining(dc -> {
                if (!dc.isAnon()) {
                    disjointClasses.add(dc.getURI());
                }
            });
            classInfo.setDisjointClasses(disjointClasses);

            // Count instances
            int instanceCount = 0;
            ExtendedIterator<? extends OntResource> instances = ontClass.listInstances();
            while (instances.hasNext()) {
                instances.next();
                instanceCount++;
            }
            classInfo.setInstanceCount(instanceCount);

            classes.add(classInfo);
        }

        return classes;
    }

    /**
     * Get properties from an ontology
     */
    @Cacheable(value = "ontologyProperties", key = "#ontologyId")
    public List<OntologyProperty> getOntologyProperties(String ontologyId) {
        OntModel model = loadedOntologies.get(ontologyId);
        if (model == null) {
            log.warn("Ontology not found: {}", ontologyId);
            return Collections.emptyList();
        }

        List<OntologyProperty> properties = new ArrayList<>();

        // Object properties
        ExtendedIterator<ObjectProperty> objPropIter = model.listObjectProperties();
        while (objPropIter.hasNext()) {
            ObjectProperty prop = objPropIter.next();
            if (prop.isAnon()) continue;

            OntologyProperty propInfo = buildPropertyInfo(prop, OntologyProperty.PropertyType.OBJECT);
            properties.add(propInfo);
        }

        // Datatype properties
        ExtendedIterator<DatatypeProperty> dataPropIter = model.listDatatypeProperties();
        while (dataPropIter.hasNext()) {
            DatatypeProperty prop = dataPropIter.next();
            if (prop.isAnon()) continue;

            OntologyProperty propInfo = buildPropertyInfo(prop, OntologyProperty.PropertyType.DATATYPE);
            properties.add(propInfo);
        }

        return properties;
    }

    private OntologyProperty buildPropertyInfo(OntProperty prop, OntologyProperty.PropertyType type) {
        OntologyProperty.OntologyPropertyBuilder builder = OntologyProperty.builder()
                .uri(prop.getURI())
                .localName(prop.getLocalName())
                .namespace(prop.getNameSpace())
                .label(getLabel(prop))
                .comment(getComment(prop))
                .type(type);

        // Get domain
        List<String> domain = new ArrayList<>();
        prop.listDomain().forEachRemaining(d -> {
            if (d.isURIResource()) {
                domain.add(d.getURI());
            }
        });
        builder.domain(domain);

        // Get range
        List<String> range = new ArrayList<>();
        prop.listRange().forEachRemaining(r -> {
            if (r.isURIResource()) {
                range.add(r.getURI());
            }
        });
        builder.range(range);

        // Set characteristics for object properties
        if (prop instanceof ObjectProperty) {
            ObjectProperty objProp = (ObjectProperty) prop;
            builder.isFunctional(objProp.isFunctionalProperty())
                   .isInverseFunctional(objProp.isInverseFunctionalProperty())
                   .isTransitive(objProp.isTransitiveProperty())
                   .isSymmetric(objProp.isSymmetricProperty());
        }

        // Set characteristics for datatype properties
        if (prop instanceof DatatypeProperty) {
            DatatypeProperty dataProp = (DatatypeProperty) prop;
            builder.isFunctional(dataProp.isFunctionalProperty());
        }

        return builder.build();
    }

    private OntModelSpec getOntologySpec(String reasonerType) {
        if (reasonerType == null || "OWL".equals(reasonerType)) {
            return OntModelSpec.OWL_MEM;
        } else if ("RDFS".equals(reasonerType)) {
            return OntModelSpec.RDFS_MEM;
        } else {
            return OntModelSpec.OWL_MEM;
        }
    }

    private int countClasses(OntModel model) {
        int count = 0;
        ExtendedIterator<OntClass> iter = model.listClasses();
        while (iter.hasNext()) {
            iter.next();
            count++;
        }
        return count;
    }

    private int countProperties(OntModel model) {
        return countObjectProperties(model) + countDataProperties(model);
    }

    private int countObjectProperties(OntModel model) {
        int count = 0;
        ExtendedIterator<ObjectProperty> iter = model.listObjectProperties();
        while (iter.hasNext()) {
            iter.next();
            count++;
        }
        return count;
    }

    private int countDataProperties(OntModel model) {
        int count = 0;
        ExtendedIterator<DatatypeProperty> iter = model.listDatatypeProperties();
        while (iter.hasNext()) {
            iter.next();
            count++;
        }
        return count;
    }

    private int countIndividuals(OntModel model) {
        int count = 0;
        ExtendedIterator<Individual> iter = model.listIndividuals();
        while (iter.hasNext()) {
            iter.next();
            count++;
        }
        return count;
    }

    private String getLabel(OntResource resource) {
        Statement labelStmt = resource.getProperty(RDFS.label);
        if (labelStmt != null) {
            return labelStmt.getString();
        }
        return resource.getLocalName();
    }

    private String getComment(OntResource resource) {
        Statement commentStmt = resource.getProperty(RDFS.comment);
        if (commentStmt != null) {
            return commentStmt.getString();
        }
        return null;
    }
}