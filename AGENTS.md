# Repository Guidelines

## Project Structure & Module Organization
- `src/` TypeScript sources: CLI entry `src/bookstack-cli.ts`, HTTP client `src/bookstack-client.ts`, config loader `src/config.ts`, UI helpers `src/ui.ts`, and commands in `src/commands/` (e.g., `import.ts`).
- `bin/` Thin Bun loader (`bin/bookstack`) that runs built JS or sources.
- `dist/` Build output from `tsc` or `bun build` (do not edit).
- `examples/` Sample inputs and usage patterns.
- Root files: `package.json`, `tsconfig.json`, `Makefile`, `.env(.example|.local)`.

## Build, Test, and Development Commands
- `bun run build` Compile TypeScript to `dist/` via `tsc`.
- `bun src/bookstack-cli.ts` Run the CLI in dev (TS, fast feedback).
- `bun dist/bookstack-cli.js` Run the built JS artifact.
- `make cli` Produce a single-file native binary at `dist/bookstack`.
- `make install` Install the native binary to `$PREFIX/bin` (default `/usr/local/bin`).
- `bun run typecheck` Strict type-check without emitting JS.
- Example: `bookstack import ./docs -b "Handbook" --dry-run`.

## Coding Style & Naming Conventions
- Language: TypeScript (ES2022). Prefer 2-space indent, semicolons, and single quotes; match nearby code.
- Files: kebab-case for multiword files (`bookstack-client.ts`); commands in `src/commands/`.
- Symbols: `PascalCase` for classes, `camelCase` for functions/vars, `SCREAMING_SNAKE_CASE` for const env keys.
- Dependencies: keep runtime deps minimal; favor utility functions in `src/ui.ts`.

## Testing Guidelines
- Framework not set up yet; prefer `bun test` when added.
- Place tests as `*.test.ts` beside modules or under `src/__tests__/`.
- Aim for coverage on command parsing, config resolution, and client request shaping; mock network I/O.
- Run (once configured): `bun test`.

## Commit & Pull Request Guidelines
- Commits: imperative, present tense, concise. The history uses short subjects (e.g., “Implement complete BookStack CLI …”). Optionally add scopes: `feat(import): support --flatten`.
- Reference issues: `Fixes #123` in commit/PR body.
- PRs: include purpose, screenshots or sample CLI output, reproduction steps, and risk notes. Update README/examples when flags or behaviors change.

## Security & Configuration Tips
- Never commit secrets. Use `.env`/`.env.local` with `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET`.
- Config is auto-discovered from `bookstack.config.(json|yaml|yml|toml)`, `.bookstackrc*`, or `package.json` (`bookstack` or `bookstack-cli` field).
- Validate connectivity with a dry run or minimal call before bulk imports.
