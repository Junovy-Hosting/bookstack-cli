import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import * as path from 'path';
import dotenv from 'dotenv';
import YAML from 'yaml';
import TOML from 'toml';

export interface ResolvedConfig {
  url?: string;
  tokenId?: string;
  tokenSecret?: string;
  source?: string;
}

type RawConfig = Record<string, unknown>;

const SEARCH_FILENAMES = [
  'bookstack-config.json',
  'bookstack.config.json',
  'bookstack.config.yaml',
  'bookstack.config.yml',
  'bookstack.config.toml',
  '.bookstackrc',
  '.bookstackrc.json',
  '.bookstackrc.yaml',
  '.bookstackrc.yml',
  '.bookstackrc.toml',
  'package.json',
];

function normalize(obj: RawConfig | undefined | null): ResolvedConfig {
  if (!obj) return {};
  const get = (k: string) => obj[k] as string | undefined;
  const result: ResolvedConfig = {
    url: (get('url') || get('baseUrl') || get('base_url'))?.toString(),
    tokenId: (get('tokenId') || get('token_id'))?.toString(),
    tokenSecret: (get('tokenSecret') || get('token_secret'))?.toString(),
  };
  return result;
}

async function readConfigFile(filePath: string): Promise<ResolvedConfig> {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  const content = await fsp.readFile(filePath, 'utf8');

  if (base === 'package.json') {
    const pkg = JSON.parse(content);
    return normalize(pkg.bookstack || pkg['bookstack-cli'] || {});
  }
  if (!ext || ext === '') {
    // try JSON then YAML as a common rc pattern
    try {
      return normalize(JSON.parse(content));
    } catch {}
    try {
      return normalize(YAML.parse(content));
    } catch {}
    return {};
  }
  if (ext === '.json') return normalize(JSON.parse(content));
  if (ext === '.yaml' || ext === '.yml') return normalize(YAML.parse(content));
  if (ext === '.toml') return normalize(TOML.parse(content) as RawConfig);
  return {};
}

async function findFileConfig(explicitPath?: string): Promise<ResolvedConfig> {
  const cwd = process.cwd();
  const candidates = explicitPath ? [explicitPath] : SEARCH_FILENAMES;

  for (const rel of candidates) {
    const p = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
    if (await pathExists(p)) {
      try {
        const conf = await readConfigFile(p);
        return { ...conf, source: p };
      } catch {
        // ignore parse errors, continue
      }
    }
  }
  return {};
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

function fromEnv(): ResolvedConfig {
  const cwd = process.cwd();
  // Load .env and .env.local if present (later loads override earlier)
  dotenv.config({ path: path.join(cwd, '.env') });
  dotenv.config({ path: path.join(cwd, '.env.local'), override: true });

  // Fallback: parse files directly in case another test suite or loader interfered
  let parsedEnv: Record<string, string> = {};
  try {
    const p = path.join(cwd, '.env');
    if (fs.existsSync(p)) {
      parsedEnv = { ...parsedEnv, ...dotenv.parse(fs.readFileSync(p, 'utf8')) };
    }
  } catch {}
  try {
    const p = path.join(cwd, '.env.local');
    if (fs.existsSync(p)) {
      parsedEnv = { ...parsedEnv, ...dotenv.parse(fs.readFileSync(p, 'utf8')) };
    }
  } catch {}

  const env = process.env;
  const pick = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = env[k];
      if (v != null && v !== '') return v;
    }
    for (const k of keys) {
      const v = parsedEnv[k];
      if (v != null && v !== '') return v;
    }
    return undefined;
  };

  const url = pick(['BOOKSTACK_URL', 'BOOKSTACK_BASE_URL', 'BOOKSTACK_HOST']);
  const tokenId = pick(['BOOKSTACK_TOKEN_ID', 'BOOKSTACK_ID']);
  const tokenSecret = pick(['BOOKSTACK_TOKEN_SECRET', 'BOOKSTACK_SECRET']);
  return { url, tokenId, tokenSecret, source: 'env' };
}

export async function resolveConfig(opts: {
  explicitPath?: string;
  cli?: { url?: string; tokenId?: string; tokenSecret?: string };
}): Promise<ResolvedConfig> {
  const fileConf = await findFileConfig(opts.explicitPath);
  const envConf = fromEnv();
  const cliConf = normalize(opts.cli as unknown as RawConfig);

  const resolved: ResolvedConfig = {
    url: cliConf.url || envConf.url || fileConf.url,
    tokenId: cliConf.tokenId || envConf.tokenId || fileConf.tokenId,
    tokenSecret: cliConf.tokenSecret || envConf.tokenSecret || fileConf.tokenSecret,
    source: cliConf.url || cliConf.tokenId || cliConf.tokenSecret
      ? 'cli'
      : envConf.url || envConf.tokenId || envConf.tokenSecret
        ? 'env'
        : fileConf.source,
  };
  return resolved;
}

export function redact(c: ResolvedConfig): ResolvedConfig {
  return {
    ...c,
    tokenId: c.tokenId ? '[SET]' : undefined,
    tokenSecret: c.tokenSecret ? '[SET]' : undefined,
  };
}

