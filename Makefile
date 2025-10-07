# AI Awareness System Makefile

.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development Environment
.PHONY: dev-setup
dev-setup: ## Set up local development environment
	@echo "Setting up development environment..."
	@./scripts/setup-dev.sh
	@docker-compose pull
	@docker-compose build
	@echo "Development environment ready!"

.PHONY: dev-start
dev-start: ## Start all development services
	@echo "Starting development services..."
	@docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	@docker-compose ps
	@echo "Services started successfully!"

.PHONY: dev-stop
dev-stop: ## Stop all development services
	@echo "Stopping development services..."
	@docker-compose down
	@echo "Services stopped!"

.PHONY: dev-clean
dev-clean: ## Clean development environment
	@echo "Cleaning development environment..."
	@docker-compose down -v
	@echo "Environment cleaned!"

.PHONY: dev-logs
dev-logs: ## Show logs from all services
	@docker-compose logs -f

.PHONY: dev-status
dev-status: ## Show status of all services
	@docker-compose ps

# Database Management
.PHONY: init-databases
init-databases: ## Initialize all databases with schemas and seed data
	@echo "Initializing databases..."
	@./scripts/init-neo4j.sh
	@./scripts/init-jena.sh
	@./scripts/init-weaviate.sh
	@./scripts/init-postgres.sh
	@echo "Databases initialized!"

.PHONY: backup-databases
backup-databases: ## Backup all databases
	@echo "Backing up databases..."
	@./scripts/backup-databases.sh
	@echo "Backup completed!"

.PHONY: restore-databases
restore-databases: ## Restore databases from backup
	@echo "Restoring databases..."
	@./scripts/restore-databases.sh
	@echo "Restore completed!"

# Service Management
.PHONY: build-services
build-services: ## Build all microservices
	@echo "Building microservices..."
	@$(MAKE) -C services/social-graph build
	@$(MAKE) -C services/knowledge-graph build
	@$(MAKE) -C services/ai-graph build
	@$(MAKE) -C services/fusion-engine build
	@$(MAKE) -C services/api-gateway build
	@echo "Services built!"

.PHONY: run-social-graph
run-social-graph: ## Run social graph service
	@cd services/social-graph && go run cmd/server/main.go

.PHONY: run-knowledge-graph
run-knowledge-graph: ## Run knowledge graph service
	@cd services/knowledge-graph && go run cmd/server/main.go

.PHONY: run-ai-graph
run-ai-graph: ## Run AI graph service
	@cd services/ai-graph && python src/main.py

.PHONY: run-fusion-engine
run-fusion-engine: ## Run fusion engine service
	@cd services/fusion-engine && go run cmd/server/main.go

.PHONY: run-api-gateway
run-api-gateway: ## Run API gateway service
	@cd services/api-gateway && npm run dev

# Testing
.PHONY: test
test: test-unit test-integration ## Run all tests

.PHONY: test-unit
test-unit: ## Run unit tests
	@echo "Running unit tests..."
	@./scripts/run-unit-tests.sh
	@echo "Unit tests completed!"

.PHONY: test-integration
test-integration: ## Run integration tests
	@echo "Running integration tests..."
	@./scripts/run-integration-tests.sh
	@echo "Integration tests completed!"

.PHONY: test-load
test-load: ## Run load tests
	@echo "Running load tests..."
	@cd tests/load && k6 run scenarios/basic-load.js
	@echo "Load tests completed!"

.PHONY: test-security
test-security: ## Run security tests
	@echo "Running security tests..."
	@./scripts/run-security-tests.sh
	@echo "Security tests completed!"

.PHONY: test-coverage
test-coverage: ## Generate test coverage report
	@echo "Generating test coverage..."
	@./scripts/generate-coverage.sh
	@echo "Coverage report generated!"

# Code Quality
.PHONY: lint
lint: ## Run linters
	@echo "Running linters..."
	@./scripts/run-linters.sh
	@echo "Linting completed!"

.PHONY: format
format: ## Format code
	@echo "Formatting code..."
	@./scripts/format-code.sh
	@echo "Code formatted!"

.PHONY: check-deps
check-deps: ## Check dependencies for vulnerabilities
	@echo "Checking dependencies..."
	@./scripts/check-dependencies.sh
	@echo "Dependency check completed!"

# Documentation
.PHONY: docs-build
docs-build: ## Build documentation
	@echo "Building documentation..."
	@cd docs && mkdocs build
	@echo "Documentation built!"

.PHONY: docs-serve
docs-serve: ## Serve documentation locally
	@echo "Serving documentation..."
	@cd docs && mkdocs serve

# Deployment
.PHONY: deploy-dev
deploy-dev: ## Deploy to development environment
	@echo "Deploying to development..."
	@kubectl apply -k infrastructure/kubernetes/overlays/dev
	@echo "Deployed to development!"

.PHONY: deploy-staging
deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	@kubectl apply -k infrastructure/kubernetes/overlays/staging
	@echo "Deployed to staging!"

.PHONY: deploy-prod
deploy-prod: ## Deploy to production environment
	@echo "⚠️  Production deployment requires confirmation"
	@read -p "Are you sure you want to deploy to production? [y/N]: " confirm; \
	if [ "$$confirm" = "y" ]; then \
		echo "Deploying to production..."; \
		kubectl apply -k infrastructure/kubernetes/overlays/prod; \
		echo "Deployed to production!"; \
	else \
		echo "Production deployment cancelled."; \
	fi

# Kubernetes
.PHONY: k8s-setup
k8s-setup: ## Set up local Kubernetes cluster
	@echo "Setting up local Kubernetes..."
	@kind create cluster --name ai-awareness --config infrastructure/kubernetes/kind-config.yaml
	@echo "Kubernetes cluster created!"

.PHONY: k8s-dashboard
k8s-dashboard: ## Open Kubernetes dashboard
	@echo "Opening Kubernetes dashboard..."
	@kubectl proxy &
	@open http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/

.PHONY: k8s-delete
k8s-delete: ## Delete local Kubernetes cluster
	@echo "Deleting local Kubernetes cluster..."
	@kind delete cluster --name ai-awareness
	@echo "Cluster deleted!"

# Monitoring
.PHONY: monitor-metrics
monitor-metrics: ## Open Grafana dashboard
	@echo "Opening Grafana dashboard..."
	@open http://localhost:3000

.PHONY: monitor-traces
monitor-traces: ## Open Jaeger UI
	@echo "Opening Jaeger UI..."
	@open http://localhost:16686

.PHONY: monitor-logs
monitor-logs: ## Stream logs from all services
	@docker-compose logs -f

# Utilities
.PHONY: clean
clean: ## Clean all build artifacts and temporary files
	@echo "Cleaning build artifacts..."
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@find . -type f -name "*.pyc" -delete
	@find . -type d -name "node_modules" -exec rm -rf {} +
	@find . -type d -name ".pytest_cache" -exec rm -rf {} +
	@find . -type d -name ".coverage" -exec rm -rf {} +
	@echo "Cleaned!"

.PHONY: install-tools
install-tools: ## Install required development tools
	@echo "Installing development tools..."
	@./scripts/install-tools.sh
	@echo "Tools installed!"

.PHONY: generate-proto
generate-proto: ## Generate protobuf files
	@echo "Generating protobuf files..."
	@./scripts/generate-proto.sh
	@echo "Protobuf files generated!"

.PHONY: seed-data
seed-data: ## Seed databases with sample data
	@echo "Seeding databases with sample data..."
	@./scripts/seed-data.sh
	@echo "Data seeded!"

# Performance
.PHONY: benchmark
benchmark: ## Run performance benchmarks
	@echo "Running performance benchmarks..."
	@./scripts/run-benchmarks.sh
	@echo "Benchmarks completed!"

.PHONY: profile
profile: ## Profile service performance
	@echo "Profiling services..."
	@./scripts/profile-services.sh
	@echo "Profiling completed!"

# Default target
.DEFAULT_GOAL := help