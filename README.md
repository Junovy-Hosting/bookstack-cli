# BookStack CLI

An Automated CLI for viewing, managing, importing, and exporting content for (BookStack)[https://www.bookstackapp.com/]

## Installation (Bun 1.2+)

1. Clone the repository:

   ```bash
   git clone git@github.com:Junovy-Hosting/bookstack-cli.git
   cd bookstack-cli
   ```

2. Install Bun (if you don't have it yet):

   ```bash
   # macOS (Homebrew)
   brew install oven-sh/bun/bun
   bun --version  # should be >= 1.2.0
   ```

3. Install dependencies with Bun:

   ```bash
   bun install
   ```

4. Build the project:
   ```bash
   bun run build
   ```

## Configuration

Before using the CLI, you need to configure your BookStack credentials:

1. Initialize a config file (optional if you prefer env vars):

   ```bash
   bun run dev config init
   ```

2. Edit the created `bookstack-config.json` file with your BookStack instance details:
   ```json
   {
     "url": "https://your-bookstack-instance.com",
     "tokenId": "your-token-id",
     "tokenSecret": "your-token-secret"
   }
   ```

You can also provide credentials via environment variables, a .env file, or other standard config formats.

### Supported Config Sources (highest priority first)

- CLI flags: `--url`, `--token-id`, `--token-secret`
- Environment variables: `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET`
- .env files in project root: `.env`, `.env.local`
- Config files (first found):
  - `bookstack-config.json` (existing default)
  - `bookstack.config.(json|yaml|yml|toml)`
  - `.bookstackrc[.(json|yaml|yml|toml)]` or `.bookstackrc`
  - `package.json` field `"bookstack": { ... }`

Example `.env`:

```bash
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your-token-id
BOOKSTACK_TOKEN_SECRET=your-token-secret
```

To point at a specific config file format/path:

```bash
bun run dev -- --config ./bookstack.config.yaml list books
```

## Usage

### Import Commands

Import a single file:

```bash
bun run dev import path/to/file.md --book "My Book"
```

Import a directory (first-level folders become chapters; files become pages):

```bash
bun run dev import path/to/directory --book "My Book"
```

Import with specific format:

```bash
bun run dev import content.html --book "Documentation" --format html
```

Dry run to see what would be imported:

```bash
bun run dev import content/ --book "Test" --dry-run
```

### List Commands

Books:

```bash
bun run dev books list
```

Chapters (requires a book ID, name, or slug):

```bash
bun run dev chapters list --book <id|name|slug>
```

Pages (optionally filter by book):

```bash
bun run dev pages list
bun run dev pages list --book <id|name|slug>

All list commands support `--json` for machine-readable output.
```

### Configuration Commands

Initialize config file:

```bash
bun run dev config init
```

Show current configuration:

```bash
bun run dev config show
```

### Options

Global options:

- `-u, --url <url>`: BookStack base URL
- `-i, --token-id <id>`: BookStack API token ID
- `-s, --token-secret <secret>`: BookStack API token secret
- `-c, --config <path>`: Config file path (auto-detected if omitted)

Import options:

- `-b, --book <name>`: Target book name or ID
- `-f, --format <format>`: Source format (markdown, html, json) - default: markdown
- `--dry-run`: Show what would be imported without making changes

For list commands, `--book` accepts ID, name, or slug.

## Supported File Formats

- Markdown (`.md`, `.markdown`)
- HTML (`.html`, `.htm`)
- Plain text (`.txt`)

## Directory Import Behavior

- Files in the root of the directory become pages directly within the target book.
- Each first-level subdirectory becomes a chapter in the book.
- Files within a subdirectory (and its nested folders) become pages inside that chapter. Nested folders are flattened into their chapter.
- Use `--flatten` to ignore chapters and import all files directly into the book.

### Chapter Metadata (.chapter-metadata.json)

Place an optional `.chapter-metadata.json` file inside any subdirectory to customize the chapter’s details:

```json
{
  "name": "Human Readable Chapter Name",
  "description": "Optional description shown in BookStack"
}
```

If no metadata is present, chapter names are derived by `--chapter-from`:

- `dir` (default): use the directory name
- `readme`: use the first Markdown heading (or first non-empty line) from `README.md`/`index.md` in that folder

### Import Options

- `--max-depth <n>`: Max recursion depth inside subdirectories (default: 10). Deeper nested folders are still flattened into their chapter.
- `--chapter-from <dir|readme>`: Source for chapter names when no metadata file is found.
- `--flatten`: Import everything directly into the book (no chapters).

## BookStack API Setup

To use this CLI, you need to:

1. Enable API access in your BookStack instance
2. Create an API token in your BookStack user settings
3. Get the Token ID and Token Secret from BookStack

## Development

Run in development mode:

```bash
bun run dev <command>
```

Build for production:

```bash
bun run build
bun start <command>
```

## Global CLI

You can use a single `bookstack` command without `bun run`:

- Option A (recommended): build a standalone binary and put it on your PATH

  ```bash
  bun run build
  bun build src/bookstack-cli.ts --compile --outfile dist/bookstack
  sudo install -m 0755 dist/bookstack /usr/local/bin/bookstack
  bookstack --help
  ```

  Using the provided Makefile instead:

  ```bash
  make cli                    # builds dist/bookstack
  sudo make install           # installs to /usr/local/bin/bookstack
  bookstack --help
  ```

- Option B: use the bundled wrapper without installing

  ```bash
  ./bin/bookstack --help
  ```

  Tip: add the repo bin to PATH for convenience in this shell:

  ```bash
  export PATH="$PWD/bin:$PATH"
  bookstack --help
  ```

- Option C: global install via Bun (may depend on Bun version)
  ```bash
  # If you hit a lockfile parse error, remove bun.lock and retry
  rm -f bun.lock && bun install && bun install -g .
  # Then
  bookstack --help
  ```

## Uninstall

- If installed via Makefile:

  ```bash
  sudo make uninstall   # removes /usr/local/bin/bookstack
  ```

- If you manually installed the binary:

  ```bash
  sudo rm -f /usr/local/bin/bookstack
  ```

- If installed globally by Bun:
  ```bash
  # Bun usually places shims under ~/.bun/bin
  rm -f ~/.bun/bin/bookstack
  ```

## Examples

Import a documentation directory:

```bash
bun run dev import ./docs --book "API Documentation" --format markdown
```

Import a single HTML file:

```bash
bun run dev import ./manual.html --book "User Manual" --format html
```

Test connection and list books:

```bash
bun run dev books list
```

> Note: This project has migrated from npm to Bun. Use `bun install`, `bun run build`, and `bun start` for all tasks.

### Book Commands

Show details and contents of a book:

```bash
bun run dev book show <id|name|slug>
# or if installed: bookstack book show <id|name|slug>
```

Export a book in various formats:

```bash
# markdown (to stdout)
bun run dev book export <id|name|slug> --format markdown --stdout

# html to file
bun run dev book export <id|name|slug> --format html --out ./book.html

# plaintext to default filename
bun run dev book export <id|name|slug> --format plaintext

# pdf to file
bun run dev book export <id|name|slug> --format pdf --out ./book.pdf

Note: PDF export can take longer to generate.
```

Show a book’s chapter/page tree:

```bash
bun run dev book tree <id|name|slug>
# include IDs
bun run dev book tree <id|name|slug> --ids
# only chapters or only pages
bun run dev book tree <id|name|slug> --type chapter
bun run dev book tree <id|name|slug> --type page

Output modes:
- `--ids` to include IDs in pretty output
- `--plain` to use simple bullets instead of tree glyphs
- `--json` to return a JSON structure of pages/chapters
```

Export a book's contents to a folder structure:

```bash
# write markdown files under ./<book-slug>/
bun run dev book export-contents <id|name|slug> --format markdown

# choose directory and format
bun run dev book export-contents <id|name|slug> --format html --dir ./out

# preview without writing
bun run dev book export-contents <id|name|slug> --dry-run
```

### Search

Search across books/chapters/pages:

```bash
# free text
bun run dev search "your query" --limit 50

# with filters (combined)
bun run dev search cloud --type page,chapter --in-name intro --updated-after 2024-01-01 \
  --tag docs --tag-kv topic=storage --sort-by last_commented

# json output
bun run dev search cloud --type page --json

Global output flags:
- `--no-color` disable colors
- `-q, --quiet` suppress spinners and non-essential logs
```

Available filters (mapped to BookStack search syntax):

- `--type <list>` → `{type:page|chapter|book}`
- `--in-name <text>` → `{in_name:"text"}`
- `--in-body <text>` → `{in_body:"text"}`
- `--created-by <slug|me>` → `{created_by:...}`
- `--updated-by <slug|me>` → `{updated_by:...}`
- `--owned-by <slug|me>` → `{owned_by:...}`
- `--created-after <YYYY-MM-DD>` → `{created_after:...}`
- `--created-before <YYYY-MM-DD>` → `{created_before:...}`
- `--updated-after <YYYY-MM-DD>` → `{updated_after:...}`
- `--updated-before <YYYY-MM-DD>` → `{updated_before:...}`
- `--is-restricted` → `{is_restricted}`
- `--is-template` → `{is_template}`
- `--viewed-by-me` → `{viewed_by_me}`
- `--not-viewed-by-me` → `{not_viewed_by_me}`
- `--sort-by last_commented` → `{sort_by:last_commented}`
- `--tag <name>` → `[name]` (repeatable)
- `--tag-kv <name=value>` → `[name=value]` (repeatable)

### Shelves

List shelves:

```bash
bun run dev shelves list

Show shelf with books:
```bash
bun run dev shelves show <id|name|slug>
```
```

Show shelf and its books:

```
bun run dev shelves show <id|name|slug>
```

### Chapter/Page Export

Export a chapter:

```bash
# markdown to stdout
bun run dev chapter export <id|name|slug> --format markdown --stdout

# html to file
bun run dev chapter export <id|name|slug> --format html --out ./chapter.html

# plaintext (default filename)
bun run dev chapter export <id|name|slug> --format plaintext

# pdf
bun run dev chapter export <id|name|slug> --format pdf --out ./chapter.pdf
```
PDF export warning: generation can take longer than text formats.
```bash
```

Export a page:

```bash
bun run dev page export <id|name|slug> --format markdown --stdout
bun run dev page export <id|name|slug> --format html --out ./page.html
bun run dev page export <id|name|slug> --format plaintext
bun run dev page export <id|name|slug> --format pdf --out ./page.pdf
```

### Chapter/Page Show & Find IDs

Inspect a chapter or page and find IDs for exports/automation:

```bash
# show chapter with its pages
bun run dev chapter show <id|name|slug>

# show page details
bun run dev page show <id|name|slug>

# find IDs (fuzzy search)
bun run dev find "intro" --type page,chapter
```

### Help / Man Page

Show a concise CLI reference:
```bash
bun run dev help
# or if installed: bookstack help
```

### Global Flags

- `--no-color` disable colors
- `-q, --quiet` suppress non-essential output
