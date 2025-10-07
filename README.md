# AI Awareness System

## 🚀 Production-Grade Three-Graph AI Platform with Claude Code SDK

A sophisticated AI system that achieves functional "awareness" by integrating Human/Social, Empirical Knowledge, and Generative AI graphs into a unified platform capable of understanding context, relationships, generating personalized insights, and **automatically creating full-stack applications using Claude Code SDK**.

## 🏗 Architecture Overview

### Three-Graph Trinity
1. **Human/Social Graph** (Neo4j) - Models relationships, interactions, and social dynamics
2. **Empirical Knowledge Graph** (Apache Jena) - Stores facts, ontologies, and reasoning capabilities
3. **Generative AI Graph** (Vector DB + LLMs) - Manages embeddings and generative capabilities

### Key Features
- **Unified Query Interface**: Single API to query across all three graphs
- **Context Synthesis**: Intelligent aggregation of information from multiple sources
- **Real-time Processing**: Stream processing with Kafka and Flink
- **Scalable Architecture**: Kubernetes-native with auto-scaling capabilities
- **Multi-LLM Support**: Integration with GPT-4, Claude, Llama, and custom models
- **🎨 Claude Code SDK Integration**: Generate complete applications, websites, and components
- **🤖 Multi-Agent Code Generation**: Orchestrates architect, coder, reviewer, tester, and deployer agents
- **🚀 Automatic Deployment**: Deploy generated apps to Vercel, AWS, Docker, and more

## 📊 System Capabilities

### Core Platform
- **Query Performance**: < 100ms p50 latency, < 500ms p99 latency
- **Throughput**: 10,000+ QPS per region
- **Availability**: 99.99% uptime SLA
- **Scale**: Handles millions of entities and relationships
- **Real-time Updates**: < 5 minute data freshness

### Code Generation (Claude Code SDK)
- **Full Application Generation**: Complete web/mobile apps in 2-5 minutes
- **Component Generation**: Individual components in < 30 seconds
- **Test Coverage**: Automatic test generation with 80%+ coverage
- **Multi-Framework Support**: React, Vue, Angular, Next.js, Express, FastAPI, and more
- **Deployment Ready**: Generated apps include Docker, K8s configs, and CI/CD pipelines

## 🛠 Technology Stack

### Core Technologies
- **Graph Databases**: Neo4j Enterprise, Apache Jena with TDB2
- **Vector Database**: Pinecone/Weaviate
- **LLM Framework**: LangChain/LlamaIndex
- **Stream Processing**: Apache Kafka + Flink
- **Container Orchestration**: Kubernetes (EKS/GKE)
- **Service Mesh**: Istio
- **API Gateway**: Kong/GraphQL

### Development Stack
- **Languages**: Python (AI/ML), Go (Services), TypeScript (APIs)
- **Monitoring**: Prometheus, Grafana, Jaeger
- **CI/CD**: GitHub Actions, ArgoCD
- **Testing**: pytest, Jest, k6 (load testing)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Kubernetes (Minikube/Kind for local development)
- Python 3.11+
- Node.js 18+
- Go 1.21+

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-awareness-system.git
cd ai-awareness-system

# Start local development environment
make dev-setup

# Run all services locally
docker-compose up -d

# Initialize databases
make init-databases

# Run tests
make test

# Access the services
# GraphQL Playground: http://localhost:4000
# Neo4j Browser: http://localhost:7474
# Grafana: http://localhost:3000
# AI Code Generation: http://localhost:8005
```

### 🎨 Using Claude Code SDK Features

#### Generate a Complete Web Application
```bash
curl -X POST http://localhost:8005/api/v1/codegen/generate-app \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-social-app",
    "type": "web-app",
    "framework": "react",
    "language": "typescript",
    "features": [
      {"name": "User Auth", "description": "JWT authentication", "priority": "high"},
      {"name": "Dashboard", "description": "Analytics dashboard", "priority": "high"}
    ],
    "database": "postgresql"
  }'
```

#### Generate from Natural Language
```bash
curl -X POST http://localhost:8005/api/v1/codegen/generate-from-description \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create a task management app like Trello with drag and drop"
  }'
```

## 📁 Project Structure

```
ai-awareness-system/
├── infrastructure/      # Kubernetes, Terraform, monitoring configs
├── services/           # Microservices (graph services, fusion engine, APIs)
├── libs/              # Shared libraries and utilities
├── clients/           # SDK implementations (Python, JS, Java)
├── docs/              # Documentation
├── tests/             # Integration, load, and security tests
└── deployment/        # Deployment scripts and Helm charts
```

## 📚 Documentation

- [Architecture Guide](docs/architecture/README.md)
- [API Documentation](docs/api/README.md)
- [Development Guide](docs/guides/development.md)
- [Deployment Guide](docs/guides/deployment.md)
- [Security Guide](docs/guides/security.md)

## 🧪 Testing

```bash
# Unit tests
make test-unit

# Integration tests
make test-integration

# Load tests
make test-load

# Security tests
make test-security

# All tests
make test-all
```

## 🚢 Deployment

### Development
```bash
make deploy-dev
```

### Staging
```bash
make deploy-staging
```

### Production
```bash
make deploy-prod
```

## 📈 Monitoring

- **Metrics**: Prometheus + Grafana dashboards
- **Logs**: ELK Stack or CloudWatch
- **Tracing**: Jaeger for distributed tracing
- **Alerts**: PagerDuty integration

## 🔒 Security

- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Authentication**: OAuth 2.0/OIDC with MFA
- **Authorization**: Fine-grained RBAC
- **Compliance**: GDPR/CCPA compliant
- **Auditing**: Comprehensive audit logging

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Technical Lead**: Architecture and Integration
- **Graph Engineers**: Neo4j, Jena, Vector DB specialists
- **ML/AI Engineers**: LLM integration and optimization
- **Backend Engineers**: Microservices and APIs
- **DevOps/SRE**: Infrastructure and operations

## 📞 Support

- **Documentation**: [docs.ai-awareness.io](https://docs.ai-awareness.io)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-awareness-system/issues)
- **Slack**: [Join our Slack](https://ai-awareness-slack.com)
- **Email**: support@ai-awareness.io