# BookStack CLI Example Usage

This directory contains example files to demonstrate the BookStack CLI functionality.

## Example Usage Commands

### 1. Import this directory as a book
```bash
npm run dev -- import examples/ --book "Example Documentation" --dry-run
```

### 2. Import a single file
```bash
npm run dev -- import examples/getting-started.md --book "User Guide" --dry-run
```

### 3. List commands (requires valid BookStack configuration)
```bash
npm run dev -- config init
# Edit bookstack-config.json with your credentials
npm run dev -- list books
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