# CLI Reference (Quick Guide)

Use `bookstack help` to see this summary in your terminal.

## Auth & Config
- Flags: `--url`, `--token-id`, `--token-secret`
- Env: `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET` (via .env/.env.local)
- Files (auto-detected):
  - `bookstack-config.json`
  - `bookstack.config.(json|yaml|yml|toml)`
  - `.bookstackrc[.(json|yaml|yml|toml)]`
  - `package.json` field `bookstack`

## Import
```bash
bookstack import <source> [--book <name|id>] [--format markdown|html|json]
                 [--max-depth <n>] [--chapter-from dir|readme] [--flatten]
                 [--dry-run]
```

## Listing
```bash
bookstack books list [--json]
bookstack chapters list --book <id|name|slug> [--json]
bookstack pages list [--book <id|name|slug>] [--json]
bookstack shelves list [--json]
```

## Books
```bash
bookstack book show <id|name|slug> [--json] [--plain]
bookstack book tree <id|name|slug> [--ids] [--type page|chapter] [--json] [--plain]
bookstack book export <id|name|slug> --format markdown|html|plaintext|pdf [--out <file>] [--stdout]
bookstack book export-contents <id|name|slug> --format markdown|html|plaintext [--dir <path>] [--dry-run]
```

## Chapters & Pages
```bash
bookstack chapter show <id|name|slug> [--json] [--plain]
bookstack chapter export <id|name|slug> --format markdown|html|plaintext|pdf [--out <file>] [--stdout]

bookstack page show <id|name|slug> [--json]
bookstack page export <id|name|slug> --format markdown|html|plaintext|pdf [--out <file>] [--stdout]
```

## Shelves
```bash
bookstack shelves show <id|name|slug>
```

## Search & Find
```bash
bookstack search "query" [filters] [--json] [--limit <n>]
bookstack find "query" --type page,chapter,book [--limit <n>]
```
Filters: `--type`, `--in-name`, `--in-body`, `--created-after/before`, `--updated-after/before`,
`--created-by`, `--updated-by`, `--owned-by`, `--is-restricted`, `--is-template`,
`--viewed-by-me`, `--not-viewed-by-me`, `--tag`, `--tag-kv`, `--sort-by`.

## Global Options
`--no-color`, `-q, --quiet`, `--config`, `--url`, `--token-id`, `--token-secret`
