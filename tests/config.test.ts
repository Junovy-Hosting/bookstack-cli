import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fsp from "node:fs/promises";
import * as os from "os";
import * as path from "path";
// NOTE: Other tests mock '../src/config.ts'. To avoid cross-test interference,
// dynamically import with a query suffix to bypass Bun's mock.module cache.
async function loadConfigReal() {
  return (await import(new URL("../dist/config.js", import.meta.url).href)) as typeof import("../src/config");
}

const CWD = process.cwd();
let tmpdir: string;

beforeEach(async () => {
  delete process.env.BOOKSTACK_URL;
  delete process.env.BOOKSTACK_TOKEN_ID;
  delete process.env.BOOKSTACK_TOKEN_SECRET;
  tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), "bookstack-cli-test-"));
  process.chdir(tmpdir);
});

afterEach(async () => {
  process.chdir(CWD);
  try { await fsp.rm(tmpdir, { recursive: true, force: true }); } catch {}
  delete process.env.BOOKSTACK_URL;
  delete process.env.BOOKSTACK_TOKEN_ID;
  delete process.env.BOOKSTACK_TOKEN_SECRET;
});

describe("resolveConfig priority (CLI > env > file)", () => {
  it("uses file when no env/cli provided", async () => {
    await fsp.writeFile("bookstack-config.json", JSON.stringify({
      url: "https://file.example",
      tokenId: "file_id",
      tokenSecret: "file_secret",
    }, null, 2));
    const { resolveConfig } = await loadConfigReal();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://file.example");
    expect(conf.tokenId).toBe("file_id");
    expect(conf.tokenSecret).toBe("file_secret");
  });

  it("env overrides file", async () => {
    await fsp.writeFile("bookstack-config.json", JSON.stringify({ url: "https://file.example", tokenId: "file_id", tokenSecret: "file_secret" }, null, 2));
    process.env.BOOKSTACK_URL = "https://env.example";
    process.env.BOOKSTACK_TOKEN_ID = "env_id";
    process.env.BOOKSTACK_TOKEN_SECRET = "env_secret";
    const { resolveConfig } = await loadConfigReal();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://env.example");
    expect(conf.tokenId).toBe("env_id");
    expect(conf.tokenSecret).toBe("env_secret");
  });

  it("CLI overrides env and file", async () => {
    await fsp.writeFile("bookstack-config.json", JSON.stringify({ url: "https://file.example" }, null, 2));
    process.env.BOOKSTACK_URL = "https://env.example";
    const { resolveConfig } = await loadConfigReal();
    const conf = await resolveConfig({ cli: { url: "https://cli.example" } });
    expect(conf.url).toBe("https://cli.example");
  });
});

describe("resolveConfig supports .env and YAML/TOML", () => {
  it("loads from .env automatically", async () => {
    await fsp.writeFile(
      ".env",
      [
        "BOOKSTACK_URL=https://dotenv.example",
        "BOOKSTACK_TOKEN_ID=dot_id",
        "BOOKSTACK_TOKEN_SECRET=dot_secret",
      ].join("\n")
    );
    const { resolveConfig } = await loadConfigReal();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://dotenv.example");
    expect(conf.tokenId).toBe("dot_id");
    expect(conf.tokenSecret).toBe("dot_secret");
  });

  it("reads YAML config", async () => {
    await fsp.writeFile(
      "bookstack.config.yaml",
      [
        "url: https://yaml.example",
        "tokenId: y_id",
        "tokenSecret: y_secret",
      ].join("\n")
    );
    const { resolveConfig } = await loadConfigReal();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://yaml.example");
    expect(conf.tokenId).toBe("y_id");
    expect(conf.tokenSecret).toBe("y_secret");
  });
});
