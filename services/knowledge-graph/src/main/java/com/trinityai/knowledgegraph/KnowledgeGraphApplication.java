package com.trinityai.knowledgegraph;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Knowledge Graph Service Application
 * Manages RDF triples, ontologies, and SPARQL queries using Apache Jena
 */
@SpringBootApplication
@EnableCaching
@EnableAsync
@EnableScheduling
public class KnowledgeGraphApplication {

    public static void main(String[] args) {
        SpringApplication.run(KnowledgeGraphApplication.class, args);
    }
}