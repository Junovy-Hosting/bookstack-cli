import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";

const CWD = process.cwd();
let tmpdir: string;

beforeEach(async () => {
  mock.restore();
  delete process.env.BOOKSTACK_URL;
  delete process.env.BOOKSTACK_TOKEN_ID;
  delete process.env.BOOKSTACK_TOKEN_SECRET;
  tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bookstack-cli-test-"));
  process.chdir(tmpdir);
});

afterEach(async () => {
  process.chdir(CWD);
  await fs.promises.rm(tmpdir, { recursive: true, force: true });
  delete process.env.BOOKSTACK_URL;
  delete process.env.BOOKSTACK_TOKEN_ID;
  delete process.env.BOOKSTACK_TOKEN_SECRET;
  mock.restore();
});

async function loadConfig() {
  const mod = await import(new URL('../src/config.ts', import.meta.url).href + '?t=' + Date.now());
  return mod.resolveConfig;
}

describe("resolveConfig priority (CLI > env > file)", () => {
  it("uses file when no env/cli provided", async () => {
    await fs.writeJSON("bookstack-config.json", {
      url: "https://file.example",
      tokenId: "file_id",
      tokenSecret: "file_secret",
    });
    const resolveConfig = await loadConfig();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://file.example");
    expect(conf.tokenId).toBe("file_id");
    expect(conf.tokenSecret).toBe("file_secret");
  });

  it("env overrides file", async () => {
    await fs.writeJSON("bookstack-config.json", {
      url: "https://file.example",
      tokenId: "file_id",
      tokenSecret: "file_secret",
    });
    process.env.BOOKSTACK_URL = "https://env.example";
    process.env.BOOKSTACK_TOKEN_ID = "env_id";
    process.env.BOOKSTACK_TOKEN_SECRET = "env_secret";
    const resolveConfig = await loadConfig();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://env.example");
    expect(conf.tokenId).toBe("env_id");
    expect(conf.tokenSecret).toBe("env_secret");
  });

  it("CLI overrides env and file", async () => {
    await fs.writeJSON("bookstack-config.json", { url: "https://file.example" });
    process.env.BOOKSTACK_URL = "https://env.example";
    const resolveConfig = await loadConfig();
    const conf = await resolveConfig({ cli: { url: "https://cli.example" } });
    expect(conf.url).toBe("https://cli.example");
  });
});

describe("resolveConfig supports .env and YAML/TOML", () => {
  it("loads from .env automatically", async () => {
    await fs.writeFile(
      ".env",
      [
        "BOOKSTACK_URL=https://dotenv.example",
        "BOOKSTACK_TOKEN_ID=dot_id",
        "BOOKSTACK_TOKEN_SECRET=dot_secret",
      ].join("\n")
    );
    const resolveConfig = await loadConfig();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://dotenv.example");
    expect(conf.tokenId).toBe("dot_id");
    expect(conf.tokenSecret).toBe("dot_secret");
  });

  it("reads YAML config", async () => {
    await fs.writeFile(
      "bookstack.config.yaml",
      [
        "url: https://yaml.example",
        "tokenId: y_id",
        "tokenSecret: y_secret",
      ].join("\n")
    );
    const resolveConfig = await loadConfig();
    const conf = await resolveConfig({});
    expect(conf.url).toBe("https://yaml.example");
    expect(conf.tokenId).toBe("y_id");
    expect(conf.tokenSecret).toBe("y_secret");
  });
});
