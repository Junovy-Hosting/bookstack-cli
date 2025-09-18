import * as fs from 'fs-extra';
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
  const content = await fs.readFile(filePath, 'utf8');

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
    if (await fs.pathExists(p)) {
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

function fromEnv(): ResolvedConfig {
  // Load .env and .env.local if present (later loads override earlier)
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });

  const env = process.env;
  const url = env.BOOKSTACK_URL || env.BOOKSTACK_BASE_URL || env.BOOKSTACK_HOST;
  const tokenId = env.BOOKSTACK_TOKEN_ID || env.BOOKSTACK_ID;
  const tokenSecret = env.BOOKSTACK_TOKEN_SECRET || env.BOOKSTACK_SECRET;
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

