import { test, expect } from "bun:test";
import { program } from "../src/bookstack-cli";

test("exposes expected top-level commands", () => {
  const names = program.commands.map((c) => c.name());
  [
    "book",
    "books",
    "chapters",
    "pages",
    "shelves",
    "search",
    "find",
    "import",
    "config",
    "help",
  ].forEach((n) => expect(names).toContain(n));
});

