# BookStack Import Bot

An Automated CLI for importing content into BookStack

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Drake-Design-Studio/bookstack-import-bot.git
   cd bookstack-import-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Before using the CLI, you need to configure your BookStack credentials:

1. Initialize a config file:
   ```bash
   npm run dev config init
   ```

2. Edit the created `bookstack-config.json` file with your BookStack instance details:
   ```json
   {
     "url": "https://your-bookstack-instance.com",
     "tokenId": "your-token-id",
     "tokenSecret": "your-token-secret"
   }
   ```

You can also provide credentials via command-line options or use a different config file path.

## Usage

### Import Commands

Import a single file:
```bash
npm run dev import path/to/file.md --book "My Book"
```

Import a directory (each file becomes a page):
```bash
npm run dev import path/to/directory --book "My Book"
```

Import with specific format:
```bash
npm run dev import content.html --book "Documentation" --format html
```

Dry run to see what would be imported:
```bash
npm run dev import content/ --book "Test" --dry-run
```

### List Commands

List all books:
```bash
npm run dev list books
```

List chapters in a book:
```bash
npm run dev list chapters --book 1
```

List pages in a book:
```bash
npm run dev list pages --book 1
```

List all pages:
```bash
npm run dev list pages
```

### Configuration Commands

Initialize config file:
```bash
npm run dev config init
```

Show current configuration:
```bash
npm run dev config show
```

### Options

Global options:
- `-u, --url <url>`: BookStack base URL
- `-i, --token-id <id>`: BookStack API token ID  
- `-s, --token-secret <secret>`: BookStack API token secret
- `-c, --config <path>`: Config file path (default: ./bookstack-config.json)

Import options:
- `-b, --book <name>`: Target book name or ID
- `-f, --format <format>`: Source format (markdown, html, json) - default: markdown
- `--dry-run`: Show what would be imported without making changes

## Supported File Formats

- Markdown (`.md`, `.markdown`)
- HTML (`.html`, `.htm`)
- Plain text (`.txt`)

## BookStack API Setup

To use this CLI, you need to:

1. Enable API access in your BookStack instance
2. Create an API token in your BookStack user settings
3. Get the Token ID and Token Secret from BookStack

## Development

Run in development mode:
```bash
npm run dev <command>
```

Build for production:
```bash
npm run build
npm start <command>
```

## Examples

Import a documentation directory:
```bash
npm run dev import ./docs --book "API Documentation" --format markdown
```

Import a single HTML file:
```bash
npm run dev import ./manual.html --book "User Manual" --format html
```

Test connection and list books:
```bash
npm run dev list books
```
