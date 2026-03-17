# @bonapasogit-dev/responder - Package Management
# Usage: make <command> [MSG="your message"]

.PHONY: help build test publish publish-patch publish-minor publish-major clean

MSG ?=

help:
	@echo "Available commands:"
	@echo "  make build                      - Build TypeScript to dist/"
	@echo "  make test                       - Run tests"
	@echo "  make publish                    - Build and publish current version"
	@echo "  make publish-patch              - Bump patch (1.0.0 → 1.0.1) and publish"
	@echo "  make publish-minor              - Bump minor (1.0.0 → 1.1.0) and publish"
	@echo "  make publish-major              - Bump major (1.0.0 → 2.0.0) and publish"
	@echo "  make clean                      - Remove dist/ folder"

build:
	@echo "🔨 Building..."
	./node_modules/.bin/tsc
	@echo "✅ Build complete"

test:
	@echo "🧪 Running tests..."
	npm test

clean:
	@echo "🧹 Cleaning..."
	rm -rf dist
	@echo "✅ Clean complete"

publish: build
	@echo "📦 Publishing current version..."
	npm publish --ignore-scripts
	@echo "✅ Published!"
	@echo "🔄 Pushing to git..."
	git add .
	$(if $(MSG),git commit -m "$(MSG)",git commit -m "chore: publish $$(node -p "require('./package.json').version")") || true
	git push origin main

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