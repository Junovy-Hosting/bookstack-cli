# API Reference

This document provides comprehensive details about the BookStack CLI commands and options.

## Authentication

The BookStack CLI uses token-based authentication through the BookStack API.

### Required Credentials
- **Token ID**: Your BookStack API token identifier
- **Token Secret**: Your BookStack API token secret

### Configuration Methods
1. **Config file** (recommended): `./bookstack-config.json`
2. **Environment variables**: Set via command line options
3. **Command line flags**: Pass directly with each command

## Commands Reference

### `import` - Import Content

Import files or directories into BookStack.

**Syntax:**
```bash
bookstack-cli import <source> [options]
```

**Options:**
- `-b, --book <name>` - Target book name or ID
- `-f, --format <format>` - Source format (markdown, html, json)
- `--dry-run` - Preview import without making changes

**Examples:**
```bash
# Import single file
bookstack-cli import README.md --book "Documentation"

# Import directory
bookstack-cli import ./docs --book "User Guide"

# Dry run to preview
bookstack-cli import ./content --book "Manual" --dry-run
```

### `list` - List Resources

List BookStack books, chapters, or pages.

**Syntax:**
```bash
bookstack-cli list <resource> [options]
```

**Resources:**
- `books` - List all books
- `chapters` - List chapters (requires --book)
- `pages` - List pages (optional --book filter)

**Options:**
- `--book <id>` - Book ID to filter by

**Examples:**
```bash
# List all books
bookstack-cli list books

# List chapters in book ID 1
bookstack-cli list chapters --book 1

# List all pages
bookstack-cli list pages
```

### `config` - Manage Configuration

Initialize or display configuration.

**Syntax:**
```bash
bookstack-cli config <action>
```

**Actions:**
- `init` - Create initial config file
- `show` - Display current configuration

## Global Options

These options can be used with any command:

- `-u, --url <url>` - BookStack base URL
- `-i, --token-id <id>` - BookStack API token ID
- `-s, --token-secret <secret>` - BookStack API token secret
- `-c, --config <path>` - Config file path
- `-h, --help` - Display help
- `-V, --version` - Show version

## Supported File Formats

The CLI can import the following file types:

- **Markdown**: `.md`, `.markdown`
- **HTML**: `.html`, `.htm`
- **Plain Text**: `.txt`

## Error Handling

The CLI provides detailed error messages for common issues:

- Invalid BookStack credentials
- Network connectivity problems
- File not found errors
- Permission denied issues

## Advanced Usage

### Batch Imports

Import multiple directories:
```bash
for dir in docs-*; do
  bookstack-cli import "$dir" --book "$dir"
done
```

### Configuration Override

Use different config per command:
```bash
bookstack-cli --config ./prod-config.json import docs/ --book "Production Docs"
```