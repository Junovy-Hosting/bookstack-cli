import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import * as fsp from "node:fs/promises";
import * as os from "os";
import * as path from "path";
import dotenv from "dotenv";

let tmpdir: string;

beforeEach(async () => {
  mock.restore();
  delete process.env.BOOKSTACK_URL;
  delete process.env.BOOKSTACK_TOKEN_ID;
  delete process.env.BOOKSTACK_TOKEN_SECRET;
  tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), "bookstack-cli-test-"));
});

afterEach(async () => {
  await fsp.rm(tmpdir, { recursive: true, force: true });
  delete process.env.BOOKSTACK_URL;
  delete process.env.BOOKSTACK_TOKEN_ID;
  delete process.env.BOOKSTACK_TOKEN_SECRET;
  mock.restore();
});

describe("resolveConfig priority (CLI > env > file)", () => {
  it("uses file when no env/cli provided", async () => {
    const { resolveConfig } = await import(new URL('../dist/config.js', import.meta.url).href);
    const filePath = path.join(tmpdir, "bookstack-config.json");
    await fsp.writeFile(filePath, JSON.stringify({
      url: "https://file.example",
      tokenId: "file_id",
      tokenSecret: "file_secret",
    }, null, 2), 'utf8');
    const conf = await resolveConfig({ explicitPath: filePath });
    expect(conf.url).toBe("https://file.example");
    expect(conf.tokenId).toBe("file_id");
    expect(conf.tokenSecret).toBe("file_secret");
  });

  it("env overrides file", async () => {
    const { resolveConfig } = await import(new URL('../dist/config.js', import.meta.url).href);
    const filePath = path.join(tmpdir, "bookstack-config.json");
    await fsp.writeFile(filePath, JSON.stringify({
      url: "https://file.example",
      tokenId: "file_id",
      tokenSecret: "file_secret",
    }, null, 2), 'utf8');
    process.env.BOOKSTACK_URL = "https://env.example";
    process.env.BOOKSTACK_TOKEN_ID = "env_id";
    process.env.BOOKSTACK_TOKEN_SECRET = "env_secret";
    const conf = await resolveConfig({ explicitPath: filePath });
    expect(conf.url).toBe("https://env.example");
    expect(conf.tokenId).toBe("env_id");
    expect(conf.tokenSecret).toBe("env_secret");
  });

  it("CLI overrides env and file", async () => {
    const { resolveConfig } = await import(new URL('../dist/config.js', import.meta.url).href);
    const filePath = path.join(tmpdir, "bookstack-config.json");
    await fsp.writeFile(filePath, JSON.stringify({ url: "https://file.example" }, null, 2), 'utf8');
    process.env.BOOKSTACK_URL = "https://env.example";
    const conf = await resolveConfig({ explicitPath: filePath, cli: { url: "https://cli.example" } });
    expect(conf.url).toBe("https://cli.example");
  });
});

describe("resolveConfig supports .env and YAML/TOML", () => {
  it("loads from .env automatically", async () => {
    const { resolveConfig } = await import(new URL('../dist/config.js', import.meta.url).href);
    const envPath = path.join(tmpdir, ".env");
    await fsp.writeFile(
      envPath,
      [
        "BOOKSTACK_URL=https://dotenv.example",
        "BOOKSTACK_TOKEN_ID=dot_id",
        "BOOKSTACK_TOKEN_SECRET=dot_secret",
      ].join("\n")
    );
    // Load the .env we just wrote without changing process.cwd
    dotenv.config({ path: envPath, override: true });
    // Also set env directly to avoid race conditions across parallel files
    process.env.BOOKSTACK_URL = "https://dotenv.example";
    process.env.BOOKSTACK_TOKEN_ID = "dot_id";
    process.env.BOOKSTACK_TOKEN_SECRET = "dot_secret";
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://dotenv.example");
    expect(conf.tokenId).toBe("dot_id");
    expect(conf.tokenSecret).toBe("dot_secret");
  });

  it("reads YAML config", async () => {
    const yamlPath = path.join(tmpdir, "bookstack.config.yaml");
    const yamlContent = [
      "url: https://yaml.example",
      "tokenId: y_id",
      "tokenSecret: y_secret",
    ].join("\n");
    await fsp.writeFile(yamlPath, yamlContent, 'utf8');
    // Clear env so file takes priority
    delete process.env.BOOKSTACK_URL;
    delete process.env.BOOKSTACK_TOKEN_ID;
    delete process.env.BOOKSTACK_TOKEN_SECRET;
    // Guard against concurrent fs-extra mocks by stubbing just for this path
    mock.module('fs-extra', () => ({
      pathExists: async (p: string) => p === yamlPath,
      readFile: async (p: string, enc?: any) => {
        if (p === yamlPath) return yamlContent;
        const fsp = await import('node:fs/promises');
        return await (fsp as any).readFile(p, enc);
      },
    }));
    const { resolveConfig } = await import(new URL('../dist/config.js', import.meta.url).href);
    const conf = await resolveConfig({ explicitPath: yamlPath });
    expect(conf.url).toBe("https://yaml.example");
    expect(conf.tokenId).toBe("y_id");
    expect(conf.tokenSecret).toBe("y_secret");
  });
});
