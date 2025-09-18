# BookStack CLI Example Usage

This directory contains example files to demonstrate the BookStack CLI functionality.

## Configuration

You can configure credentials using a `.env` file in the project root or environment variables.

Example `.env`:
```bash
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your-token-id
BOOKSTACK_TOKEN_SECRET=your-token-secret
```

Verify effective configuration:
```bash
bun run dev -- config show
```

## Example Usage Commands

### Chapter demo
This repository includes a sample directory structure demonstrating chapter metadata:

```
examples/sample-book/
  Intro/
    .chapter-metadata.json   # name + description
    README.md
    page1.md
  Advanced/
    .chapter-metadata.json
    adv.md
```

Dry run import as a book with chapters:
```bash
bun run dev -- import examples/sample-book --book "Sample Book" --dry-run
```

### 1. Import this directory as a book
```bash
bun run dev -- import examples/ --book "Example Documentation" --dry-run
```

### 2. Import a single file
```bash
bun run dev -- import examples/getting-started.md --book "User Guide" --dry-run
```

### 3. List commands (requires valid BookStack configuration)
```bash
bun run dev -- config init
# Edit bookstack-config.json with your credentials
bun run dev -- list books
```

## Files in this example:
- `getting-started.md` - A simple getting started guide
- `api-reference.md` - API documentation example
- `EXAMPLE.md` - This file

The CLI will automatically:
- Detect markdown files
- Convert them to HTML for BookStack
- Create pages in the specified book
- Handle book creation if it doesn't exist
