# Publishing Guide

This project targets Bun 1.2+ for development and runtime.

## Prerequisites

- Bun >= 1.2 installed (`bun --version`)
- Access to the npm registry (`npm whoami`)
- Update `package.json` fields as needed (name, version, repository, author)

## One-time

```bash
npm login
```

## Release steps

```bash
# bump version (semver)
# edit package.json or use npm version

# build
bun run build

# publish (dry-run first)
npm publish --dry-run
npm publish --access public
```

## Notes

- The installed CLI uses Bun to run (`#!/usr/bin/env bun`). Ensure Bun is available on target machines.
- `prepack`/`prepare` scripts build `dist/` before publishing.
- Distributed files are controlled by `files` in `package.json`.
