# @bonapasogit-dev/jwt-manager - Package Management
# Usage: make <command> [MSG="your message"]

.PHONY: help build test publish publish-patch publish-minor publish-major clean

# Default commit message (can be overridden with MSG="your message")
MSG ?=

# Default command
help:
	@echo "Available commands:"
	@echo "  make build                      - Build TypeScript to dist/"
	@echo "  make test                       - Run tests"
	@echo "  make publish                    - Build and publish current version"
	@echo "  make publish-patch              - Bump patch (1.0.0 → 1.0.1) and publish"
	@echo "  make publish-minor              - Bump minor (1.0.0 → 1.1.0) and publish"
	@echo "  make publish-major              - Bump major (1.0.0 → 2.0.0) and publish"
	@echo "  make clean                      - Remove dist/ folder"
	@echo ""
	@echo "Custom commit message:"
	@echo "  make publish-patch MSG=\"fix: resolve token expiry bug\""
	@echo ""
	@echo "First time setup:"
	@echo "  1. Create an npm account at https://www.npmjs.com"
	@echo "  2. Run: make setup-auth"

# Build TypeScript
build:
	@echo "🔨 Building..."
	./node_modules/.bin/tsc
	@echo "✅ Build complete"

# Run tests
test:
	@echo "🧪 Running tests..."
	npm test

# Clean dist folder
clean:
	@echo "🧹 Cleaning..."
	rm -rf dist
	@echo "✅ Clean complete"

# Publish current version (no version bump)
publish: build
	@echo "📦 Publishing current version..."
	npm publish --ignore-scripts
	@echo "✅ Published!"
	@echo "🔄 Pushing to git..."
	git add .
	$(if $(MSG),git commit -m "$(MSG)",git commit -m "chore: publish $$(node -p "require('./package.json').version")") || true
	git push origin main

# Bump patch version and publish (1.0.0 → 1.0.1)
publish-patch: build
	@echo "📦 Bumping patch version and publishing..."
	npm version patch --no-git-tag-version
	npm publish --ignore-scripts
	@echo "✅ Published!"
	@echo "🔄 Pushing to git..."
	git add .
	$(if $(MSG),git commit -m "$(MSG) (v$$(node -p "require('./package.json').version"))",git commit -m "chore: release v$$(node -p "require('./package.json').version")")
	git tag "v$$(node -p "require('./package.json').version")"
	git push origin main --tags

# Bump minor version and publish (1.0.0 → 1.1.0)
publish-minor: build
	@echo "📦 Bumping minor version and publishing..."
	npm version minor --no-git-tag-version
	npm publish --ignore-scripts
	@echo "✅ Published!"
	@echo "🔄 Pushing to git..."
	git add .
	$(if $(MSG),git commit -m "$(MSG) (v$$(node -p "require('./package.json').version"))",git commit -m "chore: release v$$(node -p "require('./package.json').version")")
	git tag "v$$(node -p "require('./package.json').version")"
	git push origin main --tags

# Bump major version and publish (1.0.0 → 2.0.0)
publish-major: build
	@echo "📦 Bumping major version and publishing..."
	npm version major --no-git-tag-version
	npm publish --ignore-scripts
	@echo "✅ Published!"
	@echo "🔄 Pushing to git..."
	git add .
	$(if $(MSG),git commit -m "$(MSG) (v$$(node -p "require('./package.json').version"))",git commit -m "chore: release v$$(node -p "require('./package.json').version")")
	git tag "v$$(node -p "require('./package.json').version")"
	git push origin main --tags

# Setup authentication (run once per machine)
setup-auth:
	@echo "🔐 Setting up authentication..."
	@echo "Run 'npm login' to authenticate with the public npm registry."
	@echo "Ensure your npm account has access to the @bonapasogit-dev org."
	npm login
	@echo "✅ Authentication configured!"
