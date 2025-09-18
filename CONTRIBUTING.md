# Contributing to bookstack-cli

Thanks for helping improve this CLI. This guide covers setup, style, and how to propose changes.

## Prerequisites
- Bun ≥ 1.2.0 (`bun --version`). Install: macOS `brew install oven-sh/bun/bun`.
- Node.js types for TS are bundled via dev deps; no global TypeScript needed.

## Setup
1. Clone and install deps: `bun install`
2. Create env file: copy `.env.example` → `.env` and set:
   - `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET`
3. Quick checks:
   - Type-check: `bun run typecheck`
   - Build JS: `bun run build`
   - Dev run: `bun run dev` or `bun src/bookstack-cli.ts --help`
   - Native binary (single file): `make cli` then run `./dist/bookstack --help`

## Project Structure
- `src/bookstack-cli.ts` CLI entry and command wiring
- `src/commands/` subcommands (e.g., `import.ts`)
- `src/bookstack-client.ts` BookStack API client
- `src/config.ts` config discovery and env parsing
- `src/ui.ts` output helpers (colors, spinners, progress)
- `bin/bookstack` thin Bun launcher; `dist/` is build output

## Coding Style
- TypeScript, ES2022. 2-space indent, semicolons, single quotes.
- Naming: `PascalCase` classes, `camelCase` functions/vars, kebab-case filenames.
- Keep runtime deps minimal; prefer small helpers in `src/ui.ts`.

## Tests
- A formal test runner is not yet configured. If adding tests, prefer `bun test` and colocate `*.test.ts` next to sources or under `src/__tests__/`. Mock network I/O (axios) and assert request shapes.

## Commit & PR Guidelines
- Use imperative subjects: “feat(import): add --flatten”.
- One logical change per PR. Include:
  - What/why, CLI examples, and before/after output where possible.
  - Linked issues (`Fixes #123`).
  - Docs updates (README/examples/AGENTS.md) when flags or behavior change.
  - Notes on risks and manual test steps.
- CI/Checks: run `bun run typecheck` and `bun run build` locally before pushing.

## Security & Secrets
- Never commit tokens. Use `.env`/`.env.local`. Redact logs in examples.
- Validate with dry-run when possible: `bookstack import ./docs --dry-run`.

## Releasing (maintainers)
- Bump version in `package.json`, build (`make cli`), update README if usage changed, then tag and publish.


