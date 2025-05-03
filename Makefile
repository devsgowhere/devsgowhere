# Define default target
.DEFAULT_GOAL := help
.PHONEY: help run build install-dependencies new-org new-event

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

run: ## Run the application
	npm run dev

build: ## Build the application
	npm run build

install-dependencies: ## Install dependencies
	npm install

new-org: ## Create a new organization
	@./scripts/create-org.sh

new-event: ## Create a new event
	@./scripts/create-event.sh