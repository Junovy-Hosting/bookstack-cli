# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
- `bun run build` - Compile TypeScript to dist/ directory
- `bun run typecheck` - Type checking without building
- `bun run dev` - Run in development mode (executes src/bookstack-cli.ts directly)
- `bun test` - Run tests

### Binary Creation & Installation
- `make cli` - Build standalone binary to dist/bookstack
- `make install` - Install binary to /usr/local/bin/bookstack (requires sudo)
- `make uninstall` - Remove installed binary
- `make clean` - Remove dist/ directory

### Package Management
- `bun install` - Install dependencies (uses Bun as package manager)
- `bun run prepack` - Automatically runs before npm publish

## Architecture Overview

### Core Structure
The project is a TypeScript CLI application for interacting with BookStack APIs.

**Main Entry Points:**
- `src/runner.ts` - Binary entry point that embeds version from package.json
- `src/bookstack-cli.ts` - Main CLI implementation with Commander.js

**Key Modules:**
- `src/bookstack-client.ts` - BookStack API client with interfaces for Book, Chapter, Page, Shelf
- `src/config.ts` - Multi-source configuration resolver (CLI args → env vars → config files → defaults)
- `src/commands/import.ts` - Import functionality for files/directories to BookStack
- `src/ui.ts` - Terminal UI utilities (spinners, progress bars, colors)

### Configuration System
The app supports hierarchical config resolution:
1. CLI flags (`--url`, `--token-id`, `--token-secret`)
2. Environment variables (`BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET`)
3. .env files
4. Config files (bookstack-config.json, bookstack.config.*, .bookstackrc*, package.json:bookstack field)

Supported config formats: JSON, YAML, TOML

### Command Architecture
Built with Commander.js using nested command structure:
- `books list` / `book show|export|tree|export-contents`
- `chapters list` / `chapter show|export`
- `pages list` / `page show|export`
- `shelves list|show`
- `images list|read`
- `search` / `find` (search wrapper)
- `import` (directory/file import)
- `config init|show`

### ID Resolution Pattern
Commands accept flexible identifiers (ID, name, or slug) through resolver functions:
- `resolveBookId()` at src/bookstack-cli.ts:1419
- `resolveChapterId()` at src/bookstack-cli.ts:1548
- `resolvePageId()` at src/bookstack-cli.ts:1569
- `resolveShelfId()` at src/bookstack-cli.ts:1534

### Import System
Directory imports follow specific rules:
- Root files → top-level pages
- Subdirectories → chapters
- Files in subdirectories → pages within chapters
- Supports `.book-metadata.json` and `.chapter-metadata.json` for customization
- Supports `--flatten` to ignore chapter structure

### Binary Distribution
The project uses Bun's compilation feature to create standalone binaries. The npm package includes a Node.js wrapper in `bin/bookstack` that calls the compiled dist files, allowing the CLI to work across different Node.js environments.

## Testing Guidelines

Use `bun test` to run the test suite. Tests are located alongside source files or in a dedicated test directory.

## Build Output

- TypeScript compiles to `dist/` directory
- Standalone binary builds to `dist/bookstack`
- Published package includes `dist/`, `bin/`, `src/`, and examples