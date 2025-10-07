package com.trinityai.knowledgegraph.config;

import org.apache.jena.query.*;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdfconnection.RDFConnection;
import org.apache.jena.rdfconnection.RDFConnectionFactory;
import org.apache.jena.reasoner.Reasoner;
import org.apache.jena.reasoner.ReasonerRegistry;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.PreDestroy;
import java.io.StringWriter;

/**
 * Apache Jena Configuration
 * Sets up connection to Fuseki server and reasoning capabilities
 */
@Configuration
@Slf4j
public class JenaConfig {

    @Value("${jena.fuseki.url:http://localhost:3030}")
    private String fusekiUrl;

    @Value("${jena.fuseki.dataset:knowledge}")
    private String datasetName;

    @Value("${jena.reasoning.enabled:true}")
    private boolean reasoningEnabled;

    private RDFConnection connection;
    private Model defaultModel;

    @Bean
    public RDFConnection rdfConnection() {
        String datasetUrl = fusekiUrl + "/" + datasetName;
        log.info("Connecting to Fuseki at: {}", datasetUrl);

        connection = RDFConnectionFactory.connect(datasetUrl);

        // Test connection
        try {
            connection.queryAsk("ASK { ?s ?p ?o }");
            log.info("Successfully connected to Fuseki");
        } catch (Exception e) {
            log.error("Failed to connect to Fuseki: {}", e.getMessage());
        }

        return connection;
    }

    @Bean
    public Model defaultModel() {
        defaultModel = ModelFactory.createDefaultModel();

        // Load base ontologies
        loadBaseOntologies();

        // Enable reasoning if configured
        if (reasoningEnabled) {
            Reasoner reasoner = ReasonerRegistry.getOWLReasoner();
            defaultModel = ModelFactory.createInfModel(reasoner, defaultModel);
            log.info("Reasoning enabled with OWL reasoner");
        }

        return defaultModel;
    }

    @Bean
    public QueryExecutionFactory queryExecutionFactory() {
        return new QueryExecutionFactory() {
            @Override
            public QueryExecution createQueryExecution(Query query, Model model) {
                return QueryExecutionFactory.create(query, model);
            }

            @Override
            public QueryExecution createQueryExecution(String queryString, Model model) {
                return QueryExecutionFactory.create(queryString, model);
            }

            @Override
            public QueryExecution createServiceRequest(String service, Query query) {
                return QueryExecutionFactory.sparqlService(service, query);
            }
        };
    }

    private void loadBaseOntologies() {
        try {
            // Load standard ontologies
            log.info("Loading base ontologies...");

            // RDF Schema
            defaultModel.read("http://www.w3.org/2000/01/rdf-schema#", "RDF/XML");

            // OWL
            defaultModel.read("http://www.w3.org/2002/07/owl#", "RDF/XML");

            // Dublin Core
            defaultModel.read("http://purl.org/dc/elements/1.1/", "RDF/XML");

            // FOAF (Friend of a Friend)
            defaultModel.read("http://xmlns.com/foaf/0.1/", "RDF/XML");

            log.info("Base ontologies loaded successfully");
        } catch (Exception e) {
            log.warn("Failed to load some base ontologies: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void cleanup() {
        if (connection != null) {
            connection.close();
            log.info("Closed Fuseki connection");
        }
    }

    /**
     * Utility method to serialize a model to various formats
     */
    public String serializeModel(Model model, RDFFormat format) {
        StringWriter writer = new StringWriter();
        RDFDataMgr.write(writer, model, format);
        return writer.toString();
    }

    /**
     * Interface for query execution abstraction
     */
    public interface QueryExecutionFactory {
        QueryExecution createQueryExecution(Query query, Model model);
        QueryExecution createQueryExecution(String queryString, Model model);
        QueryExecution createServiceRequest(String service, Query query);
    }
}