.PHONY: build test test-watch test-coverage clean lint type-check

## Development

build:
	npm run build

clean:
	npm run clean

lint:
	npm run lint

type-check:
	npm run type-check

## Testing

test:
	npm test

test-watch:
	npm run test

test-coverage:
	npm run test:coverage

test-ui:
	npm run test:ui

## CI/Build

ci: type-check test-coverage build
	@echo "CI checks passed"

## Cleanup

distclean:
	rm -rf dist node_modules coverage

.PHONY: help
help:
	@echo "HTTP Client Makefile"
	@echo ""
	@echo "Development targets:"
	@echo "  make build           - Build TypeScript"
	@echo "  make lint            - Run linter"
	@echo "  make type-check      - Check types"
	@echo ""
	@echo "Testing targets:"
	@echo "  make test            - Run tests in watch mode"
	@echo "  make test-coverage   - Run tests with coverage"
	@echo "  make test-ui         - Open test UI dashboard"
	@echo ""
	@echo "Cleanup targets:"
	@echo "  make clean           - Remove dist"
	@echo "  make distclean       - Remove all generated files"
	@echo ""
	@echo "CI targets:"
	@echo "  make ci              - Run full CI pipeline"
