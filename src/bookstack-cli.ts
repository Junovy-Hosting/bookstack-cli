#!/usr/bin/env node

import { Command } from "commander";
import { BookStackClient } from "./bookstack-client";
import { ImportCommand } from "./commands/import";
import * as fs from "fs-extra";
import * as path from "path";
import { resolveConfig, redact } from "./config";
import { isAxiosError } from "axios";
import { c, createSpinner, createProgressBar, configureUi, formatBytes, formatDuration } from "./ui";

const program = new Command();

// Read version from package.json at runtime (both from src and dist)
function readVersion(): string {
  try {
    if (process.env.BOOKSTACK_CLI_VERSION) {
      return process.env.BOOKSTACK_CLI_VERSION;
    }
    // dist/bookstack-cli.js -> ../package.json
    // src/bookstack-cli.ts   -> ../package.json
    // In npm package, package.json is always present at root
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json');
    return pkg?.version || '0.0.0';
  } catch {
    return process.env.BOOKSTACK_CLI_VERSION || '0.0.0';
  }
}

program
  .name("bookstack")
  .description(
    "An Automated CLI for viewing, managing, importing, and exporting content for BookStack"
  )
  .version(readVersion());

// 'help' manpage
program
  .command("help")
  .description("Show a concise CLI reference")
  .action(async () => {
    const globalOpts = program.opts();
    configureUi({ color: !globalOpts?.noColor, quiet: !!globalOpts?.quiet });
    const pad = (s: string, n = 18) => (s + ' '.repeat(n)).slice(0, n);
    const lines: string[] = [];
    lines.push(`${c.bold('BookStack CLI')} – view, import, and export BookStack content`);
    lines.push('');
    lines.push(`${c.bold('Usage')}`);
    lines.push('  bookstack [global options] <command> [subcommand] [options]');
    lines.push('');
    lines.push(`${c.bold('Global Options')}`);
    lines.push(`  ${pad('-u, --url <url>')}${c.gray('BookStack base URL')}`);
    lines.push(`  ${pad('-i, --token-id <id>')}${c.gray('API token ID')}`);
    lines.push(`  ${pad('-s, --token-secret <secret>')}${c.gray('API token secret')}`);
    lines.push(`  ${pad('-c, --config <path>')}${c.gray('Config file (auto-detected if omitted)')}`);
    lines.push(`  ${pad('-q, --quiet')}${c.gray('Suppress non-essential output')}`);
    lines.push(`  ${pad('--no-color')}${c.gray('Disable ANSI colors')}`);
    lines.push('');
    lines.push(`${c.bold('Core Commands')}`);
    lines.push(`  ${pad('books list')}${c.gray('List books (use --json for JSON)')}`);
    lines.push(`  ${pad('book show <book>')}${c.gray('Show a book with contents (--json, --plain)')}`);
    lines.push(`  ${pad('book tree <book>')}${c.gray('Tree of chapters/pages (--ids, --type, --json, --plain)')}`);
    lines.push(`  ${pad('book export <book>')}${c.gray('Export book (markdown|html|plaintext|pdf)')}`);
    lines.push(`  ${pad('book export-contents <book>')}${c.gray('Write chapter/page files to a folder')}`);
    lines.push(`  ${pad('chapters list --book <book>')}${c.gray('List chapters for a book (--json)')}`);
    lines.push(`  ${pad('chapter show <chapter>')}${c.gray('Show chapter and pages (--json, --plain)')}`);
    lines.push(`  ${pad('chapter export <chapter>')}${c.gray('Export chapter (markdown|html|plaintext|pdf)')}`);
    lines.push(`  ${pad('pages list [--book <book>]')}${c.gray('List pages (optionally by book) (--json)')}`);
    lines.push(`  ${pad('page show <page>')}${c.gray('Show page metadata (--json)')}`);
    lines.push(`  ${pad('page export <page>')}${c.gray('Export page (markdown|html|plaintext|pdf)')}`);
    lines.push(`  ${pad('shelves list')}${c.gray('List shelves (--json)')}`);
    lines.push(`  ${pad('shelves show <shelf>')}${c.gray('Show shelf and its books')}`);
    lines.push(`  ${pad('search <query>')}${c.gray('Global search (supports rich filters, --json)')}`);
    lines.push(`  ${pad('find <query>')}${c.gray('Quick ID lookup (wrapper around search)')}`);
    lines.push(`  ${pad('import <source>')}${c.gray('Import files/dirs into a book (--chapter-from, --flatten)')}`);
    lines.push(`  ${pad('config init|show')}${c.gray('Create or inspect local config')}`);
    lines.push('');
    lines.push(`${c.bold('Search Filter Examples')}`);
    lines.push(`  ${c.gray('# pages or chapters named intro since 2024')}`);
    lines.push('  bookstack search cloud --type page,chapter --in-name intro --updated-after 2024-01-01');
    lines.push(`  ${c.gray('# add tags and JSON output')}`);
    lines.push('  bookstack search cloud --tag docs --tag-kv topic=storage --json');
    lines.push('');
    lines.push(`${c.bold('Output Modes')}`);
    lines.push(`  ${pad('--json')}${c.gray('Structured JSON output (suppresses spinners)')}`);
    lines.push(`  ${pad('--plain')}${c.gray('Simpler bullet layout for tree/show')}`);
    lines.push('');
    lines.push(`${c.bold('Config Sources (priority)')}`);
    lines.push(`  ${pad('CLI flags')}${c.gray('--url, --token-id, --token-secret')}`);
    lines.push(`  ${pad('Env/.env')}${c.gray('BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, BOOKSTACK_TOKEN_SECRET')}`);
    lines.push(`  ${pad('Config files')}${c.gray('bookstack-config.json; bookstack.config.(json|yaml|yml|toml); .bookstackrc*; package.json:bookstack')}`);
    console.log(lines.join('\n'));
  });


// Book command group
const bookCmd = program
  .command("book")
  .description("Manage and inspect a single book");

// Import command (root)
program
  .command("import")
  .description("Import content into BookStack")
  .argument("<source>", "Source file or directory to import")
  .option("-b, --book <name>", "Target book name or ID")
  .option(
    "-f, --format <format>",
    "Source format (markdown, html, json)",
    "markdown"
  )
  .option(
    "--max-depth <n>",
    "Max recursion depth inside subdirectories (default: 10)",
    (v) => parseInt(v, 10),
    10
  )
  .option("--chapter-from <source>", "Chapter naming: dir|readme", "dir")
  .option(
    "--flatten",
    "Import all files directly into the book (no chapters)"
  )
  .option(
    "--dry-run",
    "Show what would be imported without making changes"
  )
  .action(async (source, options) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts?.noColor, quiet: !!globalOpts?.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const { ImportCommand } = await import("./commands/import");
      const importCmd = new ImportCommand(client);
      await importCmd.execute(source, {
        ...options,
        ...globalOpts,
      });
    } catch (error) {
      handleAxiosError(error);
    }
  });

bookCmd
  .command("show")
  .description("Show details and contents of a book")
  .argument("<book>", "Book identifier (ID, name, or slug)")
  .option("--json", "Output JSON")
  .option("--plain", "Plain text without tree glyphs")
  .action(async (bookArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({
        color: !globalOpts.noColor,
        quiet: !!globalOpts.quiet || !!opts.json,
      });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const bookId = await resolveBookId(client, String(bookArg));
      if (bookId == null) {
        console.error(c.red(`Book not found: ${bookArg}`));
        process.exit(1);
      }
      const spin = createSpinner("Fetching book…").start();
      const book = await client.getBook(bookId);
      spin.succeed("Fetched book");
      const contents = (book as any).contents || (book as any).content || [];
      const chapters = contents.filter((c: any) => c.type === "chapter");
      const pages = contents.filter((p: any) => p.type === "page");

      if (opts.json) {
        const data = {
          id: book.id,
          slug: book.slug,
          name: book.name,
          description: (book as any).description || undefined,
          top_level_pages: pages.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
          })),
          chapters: chapters.map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            slug: ch.slug,
            pages: (Array.isArray(ch.pages) ? ch.pages : []).map((p: any) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
            })),
          })),
        };
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      // Header
      console.log(
        `${c.bold(book.name)} ${c.gray(`[${book.slug}]`)} ${c.dim(
          `#${book.id}`
        )}`
      );
      if ((book as any).description) {
        console.log(`  ${c.italic((book as any).description)}`);
      }
      if (pages.length) {
        console.log(`\n${c.bold(c.cyan("Top‑level Pages"))}`);
        pages.forEach((p: any, i: number) => {
          const bullet = opts.plain
            ? "-"
            : i === pages.length - 1 && chapters.length === 0
            ? "└─"
            : "├─";
          console.log(
            ` ${bullet} ${c.green(p.name)} ${c.gray(`[${p.slug}]`)} ${c.dim(
              `#${p.id}`
            )}`
          );
        });
      }
      if (chapters.length) {
        console.log(`\n${c.bold(c.cyan("Chapters"))}`);
        chapters.forEach((ch: any, ci: number) => {
          const isLast = ci === chapters.length - 1;
          const branch = opts.plain ? "*" : isLast ? "└─" : "├─";
          console.log(
            ` ${branch} ${c.yellow(ch.name)} ${c.gray(`[${ch.slug}]`)} ${c.dim(
              `#${ch.id}`
            )}`
          );
          const chPages = Array.isArray(ch.pages) ? ch.pages : [];
          chPages.forEach((p: any, pi: number) => {
            const subBranch = opts.plain
              ? "-"
              : pi === chPages.length - 1
              ? "└─"
              : "├─";
            const prefix = opts.plain ? "  " : isLast ? "   " : "│  ";
            console.log(
              ` ${prefix}${subBranch} ${c.green(p.name)} ${c.gray(
                `[${p.slug}]`
              )} ${c.dim(`#${p.id}`)}`
            );
          });
        });
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

bookCmd
  .command("export")
  .description("Export a book to markdown, html, plaintext, or pdf")
  .argument("<book>", "Book identifier (ID, name, or slug)")
  .option(
    "-f, --format <fmt>",
    "Export format: markdown|html|plaintext|pdf",
    "markdown"
  )
  .option("-o, --out <path>", "Output file path (defaults based on format)")
  .option("--stdout", "Write text formats to stdout instead of a file")
  .action(async (bookArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const bookId = await resolveBookId(client, String(bookArg));
      if (bookId == null) {
        console.error(`Book not found: ${bookArg}`);
        process.exit(1);
      }

      const format = String(opts.format).toLowerCase();
      const book = await client.getBook(bookId);
      const slug = book.slug || `book-${bookId}`;
      const defaultOut = (() => {
        switch (format) {
          case "markdown":
            return `${slug}.md`;
          case "html":
            return `${slug}.html`;
          case "plaintext":
            return `${slug}.txt`;
          case "pdf":
            return `${slug}.pdf`;
          default:
            return `${slug}.out`;
        }
      })();

      if (format === "pdf") {
        console.log(c.yellow("Note: PDF export can take longer to generate."));
        const t0 = Date.now();
        const spin = createSpinner("Exporting book (pdf)…").start();
        const bytes = await client.exportBookPdf(bookId);
        spin.succeed("Exported book (pdf)");
        const outPath = opts.out || defaultOut;
        await fs.writeFile(outPath, bytes);
        const elapsed = Date.now() - t0;
        console.log(`Saved PDF export to ${outPath} (${formatBytes(bytes.length)}, ${formatDuration(elapsed)})`);
        return;
      }

      if (!["markdown", "html", "plaintext"].includes(format)) {
        console.error(
          "Invalid format. Use one of: markdown, html, plaintext, pdf"
        );
        process.exit(1);
      }

      const t1 = Date.now();
      const spin2 = createSpinner(`Exporting book (${format})…`).start();
      const text = await client.exportBook(bookId, format as any);
      spin2.succeed(`Exported book (${format})`);
      if (opts.stdout) {
        process.stdout.write(text);
      } else {
        const outPath = opts.out || defaultOut;
        await fs.writeFile(outPath, text, "utf8");
        const elapsed = Date.now() - t1;
        const size = Buffer.byteLength(text, 'utf8');
        console.log(`Saved ${format} export to ${outPath} (${formatBytes(size)}, ${formatDuration(elapsed)})`);
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

bookCmd
  .command("export-contents")
  .description("Export a book's chapters/pages to a folder structure")
  .argument("<book>", "Book identifier (ID, name, or slug)")
  .option("-d, --dir <path>", "Output directory (default: ./<book-slug>)")
  .option(
    "-f, --format <fmt>",
    "Content format: markdown|html|plaintext",
    "markdown"
  )
  .option("--dry-run", "Preview files without writing")
  .action(async (bookArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const bookId = await resolveBookId(client, String(bookArg));
      if (bookId == null) {
        console.error(`Book not found: ${bookArg}`);
        process.exit(1);
      }
      const book = await client.getBook(bookId);
      const slug = book.slug || `book-${bookId}`;
      const outRoot = opts.dir || `./${slug}`;
      const fmt = String(opts.format).toLowerCase();
      if (!["markdown", "html", "plaintext"].includes(fmt)) {
        console.error("Invalid format. Use one of: markdown, html, plaintext");
        process.exit(1);
      }
      const ext =
        fmt === "plaintext" ? "txt" : fmt === "markdown" ? "md" : "html";

      const contents = (book as any).contents || (book as any).content || [];
      const chapters = contents.filter((c: any) => c.type === "chapter");
      const pages = contents.filter((p: any) => p.type === "page");

      // Ensure root
      if (!opts.dryRun) await fs.ensureDir(outRoot);
      console.log(
        `Exporting to ${outRoot} in ${fmt} format${
          opts.dryRun ? " (dry-run)" : ""
        }`
      );

      // Export top-level pages
      const total =
        pages.length +
        chapters.reduce(
          (n: number, ch: any) =>
            n + (Array.isArray(ch.pages) ? ch.pages.length : 0),
          0
        );
      const bar = createProgressBar(total, "Writing");
      const t0 = Date.now();
      let files = 0;
      let bytes = 0;
      for (const p of pages) {
        const filename = `${sanitize(p.slug || p.name)}-${p.id}.${ext}`;
        const outPath = require("path").join(outRoot, filename);
        if (opts.dryRun) {
          console.log(`  Would write: ${outPath}`);
        } else {
          const text = await client.exportPage(p.id, fmt as any);
          await fs.writeFile(outPath, text, "utf8");
          // console.log(`  Wrote: ${outPath}`);
          bytes += Buffer.byteLength(text, 'utf8');
        }
        files += 1;
        bar.tick(1);
      }

      // Export chapters & pages
      for (const ch of chapters) {
        const chDir = require("path").join(
          outRoot,
          `${sanitize(ch.slug || ch.name)}-${ch.id}`
        );
        if (opts.dryRun) console.log(`  Would ensure dir: ${chDir}`);
        else await fs.ensureDir(chDir);

        const chPages = Array.isArray(ch.pages) ? ch.pages : [];
        for (const p of chPages) {
          const filename = `${sanitize(p.slug || p.name)}-${p.id}.${ext}`;
          const outPath = require("path").join(chDir, filename);
          if (opts.dryRun) {
            console.log(`    Would write: ${outPath}`);
          } else {
            const text = await client.exportPage(p.id, fmt as any);
            await fs.writeFile(outPath, text, "utf8");
            // console.log(`    Wrote: ${outPath}`);
            bytes += Buffer.byteLength(text, 'utf8');
          }
          files += 1;
          bar.tick(1);
        }
      }
      bar.stop("\n");
      const elapsed = Date.now() - t0;
      if (opts.dryRun) {
        console.log(c.dim(`Dry-run summary: ${files} files would be written under ${outRoot}.`));
      } else {
        console.log(`Wrote ${files} files to ${outRoot} (${formatBytes(bytes)}, ${formatDuration(elapsed)}).`);
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

bookCmd
  .command("tree")
  .description("Print a chapter/page tree for a book")
  .argument("<book>", "Book identifier (ID, name, or slug)")
  .option("--ids", "Include IDs in output")
  .option(
    "--type <types>",
    "Filter output: page|chapter or comma/pipe-separated"
  )
  .option("--json", "Output JSON (chapters/pages)")
  .option("--plain", "Plain text without tree glyphs")
  .action(async (bookArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({
        color: !globalOpts.noColor,
        quiet: !!globalOpts.quiet || !!opts.json,
      });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const bookId = await resolveBookId(client, String(bookArg));
      if (bookId == null) {
        console.error(`Book not found: ${bookArg}`);
        process.exit(1);
      }
      const book = await client.getBook(bookId);
      const showId = (label: string, id?: number) =>
        opts.ids && id ? ` (${label}: ${id})` : "";
      const types = opts.type
        ? String(opts.type)
            .toLowerCase()
            .split(/[|,\s]+/)
            .filter(Boolean)
        : [];
      const wantPages =
        types.length === 0 || types.includes("page") || types.includes("pages");
      const wantChapters =
        types.length === 0 ||
        types.includes("chapter") ||
        types.includes("chapters");
      const contents = (book as any).contents || (book as any).content || [];
      const chapters = contents.filter((c: any) => c.type === "chapter");
      const pages = contents.filter((p: any) => p.type === "page");
      if (opts.json) {
        const data = {
          id: book.id,
          slug: book.slug,
          name: book.name,
          pages: wantPages
            ? pages.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug }))
            : [],
          chapters: wantChapters
            ? chapters.map((ch: any) => ({
                id: ch.id,
                name: ch.name,
                slug: ch.slug,
                pages: wantPages
                  ? (Array.isArray(ch.pages) ? ch.pages : []).map((p: any) => ({
                      id: p.id,
                      name: p.name,
                      slug: p.slug,
                    }))
                  : [],
              }))
            : [],
        };
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      console.log(
        `${c.bold(book.name)} ${c.gray(`[${book.slug}]`)}${
          opts.ids ? c.dim(` #${book.id}`) : ""
        }`
      );
      if (wantPages) {
        pages.forEach((p: any, i: number) => {
          const branch = opts.plain
            ? "-"
            : i === pages.length - 1 && (!wantChapters || chapters.length === 0)
            ? "└─"
            : "├─";
          const idSuffix = opts.ids ? c.dim(` #${p.id}`) : "";
          console.log(
            ` ${branch} ${c.green(p.name)} ${c.gray(`[${p.slug}]`)}${idSuffix}`
          );
        });
      }
      if (wantChapters) {
        chapters.forEach((ch: any, ci: number) => {
          const isLast = ci === chapters.length - 1;
          const branch = opts.plain ? "*" : isLast ? "└─" : "├─";
          const idSuffix = opts.ids ? c.dim(` #${ch.id}`) : "";
          console.log(
            ` ${branch} ${c.yellow(ch.name)} ${c.gray(
              `[${ch.slug}]`
            )}${idSuffix}`
          );
          if (wantPages) {
            const chPages = (ch.pages || []) as any[];
            chPages.forEach((p: any, pi: number) => {
              const subBranch = opts.plain
                ? "-"
                : pi === chPages.length - 1
                ? "└─"
                : "├─";
              const prefix = opts.plain ? "  " : isLast ? "   " : "│  ";
              const pidSuffix = opts.ids ? c.dim(` #${p.id}`) : "";
              console.log(
                ` ${prefix}${subBranch} ${c.green(p.name)} ${c.gray(
                  `[${p.slug}]`
                )}${pidSuffix}`
              );
            });
          }
        });
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Search command
program
  .command("search")
  .description("Search across BookStack content")
  .argument("<query>", "Search query")
  .option(
    "-l, --limit <n>",
    "Limit number of results shown",
    (v) => parseInt(v, 10),
    25
  )
  .option(
    "--type <types>",
    "Restrict types: page|chapter|book or comma/pipe-separated"
  )
  .option("--in-name <text>", "Require text in name")
  .option("--in-body <text>", "Require text in body")
  .option("--created-by <slug|me>", "Created by user slug or me")
  .option("--updated-by <slug|me>", "Updated by user slug or me")
  .option("--owned-by <slug|me>", "Owned by user slug or me")
  .option("--created-after <YYYY-MM-DD>", "Created after date")
  .option("--created-before <YYYY-MM-DD>", "Created before date")
  .option("--updated-after <YYYY-MM-DD>", "Updated after date")
  .option("--updated-before <YYYY-MM-DD>", "Updated before date")
  .option("--is-restricted", "Only items with content-level permissions")
  .option("--is-template", "Only page templates")
  .option("--viewed-by-me", "Only content viewed by me")
  .option("--not-viewed-by-me", "Only content not viewed by me")
  .option("--sort-by <method>", "Sort method (last_commented)")
  .option("--tag <name>", "Tag name filter [name]", collect, [])
  .option(
    "--tag-kv <name=value>",
    "Tag name/value filter [name=value]",
    collect,
    []
  )
  .option("--json", "Output JSON")
  .action(async (query: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet || !!opts.json });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const builtQuery = buildSearchQuery(query, opts);
      const spin = createSpinner("Searching…").start();
      const results = await client.searchAll(builtQuery);
      spin.succeed(`Found ${results.length} results`);
      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const lim = Math.max(1, opts.limit || 25);
      const subset = results.slice(0, lim);
      if (!subset.length) {
        console.log(c.dim("No results."));
        return;
      }
      const typeColor = (t: string) =>
        t === "page" ? c.green : t === "chapter" ? c.yellow : c.cyan;
      console.log(c.bold("Results:"));
      subset.forEach((r) => {
        const bullet = "•";
        const t = (r.type || "").toLowerCase();
        const tcol = typeColor(t);
        const id = r.id != null ? c.dim(`#${r.id}`) : "";
        const slug = r.slug ? c.gray(`[${r.slug}]`) : "";
        const ctx =
          t === "page"
            ? `${c.cyan("book")}:${r.book_id}${
                r.chapter_id ? ` ${c.cyan("chapter")}:${r.chapter_id}` : ""
              }`
            : t === "chapter"
            ? `${c.cyan("book")}:${r.book_id}`
            : "";
        const url = r.url ? ` ${c.gray("->")} ${c.gray(r.url)}` : "";
        console.log(
          ` ${bullet} ${tcol(`[${t || "item"}]`)} ${r.name} ${slug} ${id} ${ctx}${url}`.trim()
        );
      });
      if (results.length > subset.length) {
        console.log(
          c.dim(
            `... ${results.length - subset.length} more not shown (use --limit to increase).`
          )
        );
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Shelves commands
const shelvesCmd = program.command("shelves").description("Manage shelves");

shelvesCmd
  .command("list")
  .description("List shelves")
  .action(async () => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const spin = createSpinner("Fetching shelves…").start();
      const shelves = await client.getShelves();
      spin.succeed(`Fetched ${shelves.length} shelves`);
      console.log("Shelves:");
      shelves.forEach((s) => {
        console.log(`  ${s.id}: ${s.name} (${s.slug})`);
      });
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Images commands
const imagesCmd = program.command("images").description("Manage images (image gallery)");

imagesCmd
  .command("list")
  .description("List images in the image gallery")
  .option("--json", "Output JSON")
  .action(async (opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet || !!opts.json });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: { url: globalOpts.url, tokenId: globalOpts.tokenId, tokenSecret: globalOpts.tokenSecret },
      });
      const client = new BookStackClient({ baseUrl: config.url || '', tokenId: config.tokenId || '', tokenSecret: config.tokenSecret || '' });
      const spin = createSpinner('Fetching images…').start();
      const items = await client.getImages();
      spin.succeed(`Fetched ${items.length} images`);
      if (opts.json) { console.log(JSON.stringify(items, null, 2)); return; }
      if (!items.length) { console.log(c.dim('No images.')); return; }
      console.log(c.bold('Images:'));
      items.forEach(it => {
        const url = it.url ? `${it.url}` : '';
        const line = `  ${c.yellow('#'+it.id)} ${c.green(it.name)} ${it.type ? c.gray('('+it.type+')') : ''}${url ? ' ' + c.cyan(url) : ''}`;
        console.log(line);
      });
    } catch (error) { handleAxiosError(error); }
  });

imagesCmd
  .command('read')
  .description('Show details for a specific image')
  .argument('<id>', 'Image ID')
  .option('--json', 'Output JSON')
  .action(async (id: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet || !!opts.json });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: { url: globalOpts.url, tokenId: globalOpts.tokenId, tokenSecret: globalOpts.tokenSecret },
      });
      const client = new BookStackClient({ baseUrl: config.url || '', tokenId: config.tokenId || '', tokenSecret: config.tokenSecret || '' });
      const spin = createSpinner('Fetching image…').start();
      const img = await client.getImage(parseInt(id, 10));
      spin.succeed('Fetched image');
      if (opts.json) { console.log(JSON.stringify(img, null, 2)); return; }
      console.log(`${c.bold(img.name)} ${c.dim('#'+img.id)} ${img.type ? c.gray('('+img.type+')') : ''}`);
      if (img.url) console.log(`  ${c.cyan(img.url)}`);
      if (img.created_at) console.log(`  Created: ${img.created_at}`);
      if (img.updated_at) console.log(`  Updated: ${img.updated_at}`);
      if (typeof img.uploaded_to !== 'undefined') console.log(`  Uploaded To: ${img.uploaded_to}`);
    } catch (error) { handleAxiosError(error); }
  });

// Books commands
const booksCmd = program.command("books").description("Manage books");

booksCmd
  .command("list")
  .description("List books")
  .action(async () => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const spin = createSpinner("Fetching books…").start();
      const books = await client.getBooks();
      spin.succeed(`Fetched ${books.length} books`);
      console.log(c.bold("Books:"));
      books.forEach((b) => console.log(`  ${b.id}: ${b.name} (${b.slug})`));
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Chapters commands
const chaptersCmd = program.command("chapters").description("Manage chapters");

chaptersCmd
  .command("list")
  .description("List chapters in a book")
  .option("--book <id|name|slug>", "Book to filter by (required)")
  .action(async (opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      if (!opts.book) {
        console.error("--book option is required");
        process.exit(1);
      }
      const bookId = await resolveBookId(client, String(opts.book));
      if (bookId == null) {
        console.error(`Book not found: ${opts.book}`);
        process.exit(1);
      }
      const spin = createSpinner("Fetching chapters…").start();
      const chapters = await client.getChapters(bookId);
      spin.succeed(`Fetched ${chapters.length} chapters`);
      console.log(c.bold(`Chapters in book ${opts.book}:`));
      chapters.forEach((ch) =>
        console.log(`  ${ch.id}: ${ch.name} (${ch.slug})`)
      );
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Pages commands
const pagesCmd = program.command("pages").description("Manage pages");

pagesCmd
  .command("list")
  .description("List pages (optionally for a book)")
  .option("--book <id|name|slug>", "Book to filter by")
  .action(async (opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const spin = createSpinner(
        opts.book ? "Fetching pages…" : "Fetching all pages…"
      ).start();
      const pages = opts.book
        ? await (async () => {
            const bookId = await resolveBookId(client, String(opts.book));
            if (bookId == null) {
              console.error(`Book not found: ${opts.book}`);
              process.exit(1);
            }
            return client.getPages(bookId);
          })()
        : await client.getAllPages();
      spin.succeed(`Fetched ${pages.length} pages`);
      console.log(
        c.bold(opts.book ? `Pages in book ${opts.book}:` : "All pages:")
      );
      pages.forEach((p) => console.log(`  ${p.id}: ${p.name} (${p.slug})`));
    } catch (error) {
      handleAxiosError(error);
    }
  });

shelvesCmd
  .command("show")
  .description("Show details of a shelf and its books")
  .argument("<shelf>", "Shelf identifier (ID, name, or slug)")
  .action(async (shelfArg: string) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const shelfId = await resolveShelfId(client, String(shelfArg));
      if (shelfId == null) {
        console.error(`Shelf not found: ${shelfArg}`);
        process.exit(1);
      }
      const spin = createSpinner("Fetching shelf…").start();
      const shelf = await client.getShelf(shelfId);
      spin.succeed("Fetched shelf");
      console.log(`${shelf.name} (ID: ${shelf.id}, slug: ${shelf.slug})`);
      if (shelf.description) console.log(`Description: ${shelf.description}`);
      const books = (shelf.books || []) as any[];
      if (books.length) {
        console.log("Books:");
        books.forEach((b) => console.log(`  ${b.id}: ${b.name} (${b.slug})`));
      } else {
        console.log("Books: (none)");
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Chapter commands
const chapterCmd = program.command("chapter").description("Manage chapters");

chapterCmd
  .command("export")
  .description("Export a chapter to markdown, html, plaintext, or pdf")
  .argument("<chapter>", "Chapter identifier (ID, name, or slug)")
  .option(
    "-f, --format <fmt>",
    "Export format: markdown|html|plaintext|pdf",
    "markdown"
  )
  .option("-o, --out <path>", "Output file path (defaults based on format)")
  .option("--stdout", "Write text formats to stdout instead of a file")
  .action(async (chapterArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const chapterId = await resolveChapterId(client, String(chapterArg));
      if (chapterId == null) {
        console.error(`Chapter not found: ${chapterArg}`);
        process.exit(1);
      }

      const format = String(opts.format).toLowerCase();
      if (format === "pdf") {
        console.log(c.yellow("Note: PDF export can take longer to generate."));
        const t0 = Date.now();
        const spin = createSpinner("Exporting chapter (pdf)…").start();
        const bytes = await client.exportChapterPdf(chapterId);
        spin.succeed("Exported chapter (pdf)");
        const outPath = opts.out || `chapter-${chapterId}.pdf`;
        await fs.writeFile(outPath, bytes);
        const elapsed = Date.now() - t0;
        console.log(`Saved PDF export to ${outPath} (${formatBytes(bytes.length)}, ${formatDuration(elapsed)})`);
        return;
      }
      if (!["markdown", "html", "plaintext"].includes(format)) {
        console.error(
          "Invalid format. Use one of: markdown, html, plaintext, pdf"
        );
        process.exit(1);
      }
      const t1 = Date.now();
      const spin2 = createSpinner(`Exporting chapter (${format})…`).start();
      const text = await client.exportChapter(chapterId, format as any);
      spin2.succeed(`Exported chapter (${format})`);
      if (opts.stdout) process.stdout.write(text);
      else {
        const outPath =
          opts.out ||
          `chapter-${chapterId}.${format === "plaintext" ? "txt" : format}`;
        await fs.writeFile(outPath, text, "utf8");
        const elapsed = Date.now() - t1;
        const size = Buffer.byteLength(text, 'utf8');
        console.log(`Saved ${format} export to ${outPath} (${formatBytes(size)}, ${formatDuration(elapsed)})`);
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Page commands
const pageCmd = program.command("page").description("Manage pages");

pageCmd
  .command("export")
  .description("Export a page to markdown, html, plaintext, or pdf")
  .argument("<page>", "Page identifier (ID, name, or slug)")
  .option(
    "-f, --format <fmt>",
    "Export format: markdown|html|plaintext|pdf",
    "markdown"
  )
  .option("-o, --out <path>", "Output file path (defaults based on format)")
  .option("--stdout", "Write text formats to stdout instead of a file")
  .action(async (pageArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const pageId = await resolvePageId(client, String(pageArg));
      if (pageId == null) {
        console.error(`Page not found: ${pageArg}`);
        process.exit(1);
      }

      const format = String(opts.format).toLowerCase();
      if (format === "pdf") {
        console.log(c.yellow("Note: PDF export can take longer to generate."));
        const t0 = Date.now();
        const spin = createSpinner("Exporting page (pdf)…").start();
        const bytes = await client.exportPagePdf(pageId);
        spin.succeed("Exported page (pdf)");
        const outPath = opts.out || `page-${pageId}.pdf`;
        await fs.writeFile(outPath, bytes);
        const elapsed = Date.now() - t0;
        console.log(`Saved PDF export to ${outPath} (${formatBytes(bytes.length)}, ${formatDuration(elapsed)})`);
        return;
      }
      if (!["markdown", "html", "plaintext"].includes(format)) {
        console.error(
          "Invalid format. Use one of: markdown, html, plaintext, pdf"
        );
        process.exit(1);
      }
      const t1 = Date.now();
      const spin2 = createSpinner(`Exporting page (${format})…`).start();
      const text = await client.exportPage(pageId, format as any);
      spin2.succeed(`Exported page (${format})`);
      if (opts.stdout) process.stdout.write(text);
      else {
        const outPath =
          opts.out ||
          `page-${pageId}.${format === "plaintext" ? "txt" : format}`;
        await fs.writeFile(outPath, text, "utf8");
        const elapsed = Date.now() - t1;
        const size = Buffer.byteLength(text, 'utf8');
        console.log(`Saved ${format} export to ${outPath} (${formatBytes(size)}, ${formatDuration(elapsed)})`);
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

chapterCmd
  .command("show")
  .description("Show details and pages of a chapter")
  .argument("<chapter>", "Chapter identifier (ID, name, or slug)")
  .option("--json", "Output JSON")
  .option("--plain", "Plain text without tree glyphs")
  .action(async (chapterArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const chapterId = await resolveChapterId(client, String(chapterArg));
      if (chapterId == null) {
        console.error(`Chapter not found: ${chapterArg}`);
        process.exit(1);
      }
      const spin = createSpinner("Fetching chapter…").start();
      const ch = await client.getChapter(chapterId);
      spin.succeed("Fetched chapter");
      if (opts.json) {
        let pages: any[] = [];
        if (ch.book_id) {
          pages = (await client.getPages(ch.book_id))
            .filter((p) => p.chapter_id === ch.id)
            .map((p) => ({ id: p.id, name: p.name, slug: p.slug }));
        }
        console.log(
          JSON.stringify(
            {
              id: ch.id,
              slug: ch.slug,
              name: ch.name,
              description: ch.description || undefined,
              pages,
            },
            null,
            2
          )
        );
        return;
      }
      console.log(
        `${c.bold(ch.name)} ${c.gray(`[${ch.slug}]`)} ${c.dim(`#${ch.id}`)}`
      );
      if (ch.description) console.log(`  ${c.italic(ch.description)}`);
      if (!ch.book_id) {
        console.log("Pages: (unknown book; skipping)");
        return;
      }
      const pages = (await client.getPages(ch.book_id)).filter(
        (p) => p.chapter_id === ch.id
      );
      if (pages.length) {
        console.log(`\n${c.bold(c.cyan("Pages"))}`);
        pages.forEach((p, i) => {
          const branch = opts.plain
            ? "-"
            : i === pages.length - 1
            ? "└─"
            : "├─";
          console.log(
            ` ${branch} ${c.green(p.name)} ${c.gray(`[${p.slug}]`)} ${c.dim(
              `#${p.id}`
            )}`
          );
        });
      } else {
        console.log(c.dim("Pages: (none)"));
      }
    } catch (error) {
      handleAxiosError(error);
    }
  });

pageCmd
  .command("show")
  .description("Show details of a page")
  .argument("<page>", "Page identifier (ID, name, or slug)")
  .option("--json", "Output JSON")
  .action(async (pageArg: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const pageId = await resolvePageId(client, String(pageArg));
      if (pageId == null) {
        console.error(`Page not found: ${pageArg}`);
        process.exit(1);
      }
      const spin = createSpinner("Fetching page…").start();
      const p = await client.getPage(pageId);
      spin.succeed("Fetched page");
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              id: p.id,
              slug: p.slug,
              name: p.name,
              book_id: p.book_id,
              chapter_id: p.chapter_id || null,
            },
            null,
            2
          )
        );
        return;
      }
      console.log(
        `${c.bold(p.name)} ${c.gray(`[${p.slug}]`)} ${c.dim(`#${p.id}`)}`
      );
      console.log(
        `  ${c.cyan("Book")}: ${p.book_id} ${
          p.chapter_id ? `${c.cyan("Chapter")}: ${p.chapter_id}` : ""
        }`
      );
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Find helper: quick way to get IDs by fuzzy query
program
  .command("find")
  .description("Find items and print IDs (wrapper around search)")
  .argument("<query>", "Search query (fuzzy)")
  .option(
    "--type <types>",
    "Restrict types: page|chapter|book or comma/pipe-separated"
  )
  .option(
    "-l, --limit <n>",
    "Limit number of results shown",
    (v) => parseInt(v, 10),
    50
  )
  .action(async (query: string, opts: any) => {
    try {
      const globalOpts = program.opts();
      configureUi({ color: !globalOpts.noColor, quiet: !!globalOpts.quiet });
      const config = await resolveConfig({
        explicitPath: globalOpts.config,
        cli: {
          url: globalOpts.url,
          tokenId: globalOpts.tokenId,
          tokenSecret: globalOpts.tokenSecret,
        },
      });

      const client = new BookStackClient({
        baseUrl: config.url || "",
        tokenId: config.tokenId || "",
        tokenSecret: config.tokenSecret || "",
      });

      const built = buildSearchQuery(query, { type: opts.type });
      const results = await client.searchAll(built);
      const lim = Math.max(1, opts.limit || 50);
      if (!results.length) {
        console.log("No results.");
        return;
      }
      results.slice(0, lim).forEach((r) => {
        const ctx =
          r.type === "page"
            ? `book_id=${r.book_id} chapter_id=${r.chapter_id || "-"}`
            : r.type === "chapter"
            ? `book_id=${r.book_id}`
            : "";
        console.log(
          `${r.id}\t${r.type}\t${r.name}\t${r.slug}${ctx ? `\t${ctx}` : ""}`
        );
      });
    } catch (error) {
      handleAxiosError(error);
    }
  });

// Config command
program
  .command("config")
  .description("Manage configuration")
  .argument("<action>", "Action (init, show)")
  .action(async (action) => {
    const configPath = program.opts().config || "./bookstack-config.json";

    switch (action) {
      case "init":
        const defaultConfig = {
          url: "https://your-bookstack-instance.com",
          tokenId: "your-token-id",
          tokenSecret: "your-token-secret",
        };

        if (await fs.pathExists(configPath)) {
          console.log(`Config file already exists at ${configPath}`);
        } else {
          await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
          console.log(`Created config file at ${configPath}`);
          console.log("Please edit the file with your BookStack credentials.");
        }
        break;
      case "show":
        {
          const globalOpts = program.opts();
          const config = await resolveConfig({
            explicitPath: configPath,
            cli: {
              url: globalOpts.url,
              tokenId: globalOpts.tokenId,
              tokenSecret: globalOpts.tokenSecret,
            },
          });
          console.log("Effective configuration (CLI > env > file):");
          console.log(`  Source: ${config.source || "file/env/defaults"}`);
          console.log(`  URL: ${config.url || "Not set"}`);
          console.log(`  Token ID: ${config.tokenId ? "[SET]" : "Not set"}`);
          console.log(
            `  Token Secret: ${config.tokenSecret ? "[SET]" : "Not set"}`
          );
        }
        break;
      default:
        console.error(`Unknown action: ${action}`);
        console.error("Available actions: init, show");
        process.exit(1);
    }
  });

// Parse arguments and run
if (require.main === module) {
  program.parse();
}

export { program };

async function resolveBookId(
  client: BookStackClient,
  bookArg: string
): Promise<number | null> {
  if (/^\d+$/.test(bookArg)) {
    return parseInt(bookArg, 10);
  }
  const byNameOrSlug = await client.findBookByName(bookArg);
  return byNameOrSlug ? byNameOrSlug.id : null;
}

function handleAxiosError(error: unknown) {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const url = error.config?.url || "";
    if (status === 404) {
      console.error(
        `Not found (404) while requesting ${url}. Check the identifier and permissions.`
      );
    } else if (status === 401 || status === 403) {
      console.error(
        `Auth error (${status}). Verify your BookStack tokens and URL.`
      );
    } else {
      console.error(
        `HTTP error${status ? " " + status : ""}: ${error.message}`
      );
    }
  } else {
    console.error("Error:", (error as any)?.message || String(error));
  }
  process.exit(1);
}

function collect(val: string, memo: string[]) {
  memo.push(val);
  return memo;
}

function buildSearchQuery(base: string, flags: any): string {
  const tokens: string[] = [];
  if (base && String(base).trim()) tokens.push(String(base).trim());
  const addFilter = (name: string, value?: string) => {
    if (value == null || value === "") tokens.push(`{${name}}`);
    else tokens.push(`{${name}:${escapeFilterValue(value)}}`);
  };
  const addTag = (expr: string) => tokens.push(`[${expr}]`);

  // type
  if (flags.type) {
    const raw = String(flags.type).replace(/[,\s]+/g, "|");
    addFilter("type", raw);
  }
  if (flags.inName) addFilter("in_name", String(flags.inName));
  if (flags.inBody) addFilter("in_body", String(flags.inBody));

  // user filters
  if (flags.createdBy) addFilter("created_by", String(flags.createdBy));
  if (flags.updatedBy) addFilter("updated_by", String(flags.updatedBy));
  if (flags.ownedBy) addFilter("owned_by", String(flags.ownedBy));

  // date filters
  const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (flags.createdAfter) {
    if (!dateOk(flags.createdAfter)) invalidDate("created-after");
    addFilter("created_after", String(flags.createdAfter));
  }
  if (flags.createdBefore) {
    if (!dateOk(flags.createdBefore)) invalidDate("created-before");
    addFilter("created_before", String(flags.createdBefore));
  }
  if (flags.updatedAfter) {
    if (!dateOk(flags.updatedAfter)) invalidDate("updated-after");
    addFilter("updated_after", String(flags.updatedAfter));
  }
  if (flags.updatedBefore) {
    if (!dateOk(flags.updatedBefore)) invalidDate("updated-before");
    addFilter("updated_before", String(flags.updatedBefore));
  }

  // option flags
  if (flags.isRestricted) addFilter("is_restricted");
  if (flags.isTemplate) addFilter("is_template");
  if (flags.viewedByMe) addFilter("viewed_by_me");
  if (flags.notViewedByMe) addFilter("not_viewed_by_me");
  if (flags.sortBy) addFilter("sort_by", String(flags.sortBy));

  // tags
  (flags.tag || []).forEach((t: string) => addTag(t));
  (flags.tagKv || []).forEach((kv: string) => addTag(kv));

  return tokens.join(" ").trim();
}

function invalidDate(flagName: string): never {
  console.error(`Invalid date for --${flagName}. Use YYYY-MM-DD.`);
  process.exit(1);
}

function escapeFilterValue(val: string): string {
  // Wrap in quotes if contains spaces or special chars to be safe
  if (/\s/.test(val)) return `"${val.replace(/"/g, '\\"')}"`;
  return val;
}

function sanitize(input: string): string {
  return String(input)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_.\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 100);
}

async function resolveShelfId(
  client: BookStackClient,
  shelfArg: string
): Promise<number | null> {
  if (/^\d+$/.test(shelfArg)) return parseInt(shelfArg, 10);
  const shelves = await client.getShelves();
  const match = shelves.find(
    (s) =>
      s.slug.toLowerCase() === shelfArg.toLowerCase() ||
      s.name.toLowerCase() === shelfArg.toLowerCase()
  );
  return match ? match.id : null;
}

async function resolveChapterId(
  client: BookStackClient,
  chapterArg: string
): Promise<number | null> {
  if (/^\d+$/.test(chapterArg)) return parseInt(chapterArg, 10);
  const results = await client.searchAll(`{type:chapter} ${chapterArg}`);
  const exactSlug = results.find(
    (r) =>
      r.type === "chapter" && r.slug.toLowerCase() === chapterArg.toLowerCase()
  );
  if (exactSlug) return exactSlug.id;
  const exactName = results.find(
    (r) =>
      r.type === "chapter" && r.name.toLowerCase() === chapterArg.toLowerCase()
  );
  if (exactName) return exactName.id;
  if (results.filter((r) => r.type === "chapter").length === 1)
    return results.find((r) => r.type === "chapter")!.id;
  return null;
}

async function resolvePageId(
  client: BookStackClient,
  pageArg: string
): Promise<number | null> {
  if (/^\d+$/.test(pageArg)) return parseInt(pageArg, 10);
  const results = await client.searchAll(`{type:page} ${pageArg}`);
  const exactSlug = results.find(
    (r) => r.type === "page" && r.slug.toLowerCase() === pageArg.toLowerCase()
  );
  if (exactSlug) return exactSlug.id;
  const exactName = results.find(
    (r) => r.type === "page" && r.name.toLowerCase() === pageArg.toLowerCase()
  );
  if (exactName) return exactName.id;
  if (results.filter((r) => r.type === "page").length === 1)
    return results.find((r) => r.type === "page")!.id;
  return null;
}
