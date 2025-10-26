import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

// Capture console.log output for an async action
async function withCapturedStdout(fn: () => Promise<void> | void) {
  let out = '';
  const origLog = console.log;
  console.log = (...args: any[]) => {
    const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    out += (out.endsWith('\n') || out.length === 0 ? '' : '\n') + line + '\n';
  };
  try {
    await fn();
  } finally {
    console.log = origLog;
  }
  return out;
}

async function loadProgram() {
  const mod = await import(new URL('../src/bookstack-cli.ts', import.meta.url).href);
  return mod.program as import('../src/bookstack-cli').program;
}

beforeEach(() => {
  mock.restore();
});

afterEach(() => {
  mock.restore();
});

describe('Import command', () => {
  it('delegates to ImportCommand with provided options', async () => {
    const importCalls: Array<{ source: string; opts: any; client: any }> = [];
    const constructedConfigs: any[] = [];

    mock.module(new URL('../src/config.ts', import.meta.url).href, () => ({
      resolveConfig: async () => ({ url: 'https://mock', tokenId: 'id', tokenSecret: 'secret' }),
      redact: (cfg: any) => cfg,
    }));

    const { formatBytes, formatDuration } = await import('../src/ui');
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({
        start() { return this; },
        succeed() { return this; },
        fail() { return this; },
        stop() {},
      }),
      createProgressBar: () => ({ tick() {}, update() {}, stop() {} }),
      formatBytes,
      formatDuration,
    }));

    mock.module(new URL('../src/bookstack-client.ts', import.meta.url).href, () => ({
      BookStackClient: class {
        constructor(cfg: any) {
          constructedConfigs.push(cfg);
        }
      },
    }));

    mock.module(new URL('../src/commands/import.ts', import.meta.url).href, () => ({
      ImportCommand: class {
        client: any;
        constructor(client: any) {
          this.client = client;
        }
        async execute(source: string, opts: any) {
          importCalls.push({ source, opts, client: this.client });
          console.log(`Import stub executed for ${source}`);
        }
      },
    }));

    const program = await loadProgram();
    const output = await withCapturedStdout(async () => {
      await program.parseAsync([
        'node',
        'bookstack',
        'import',
        './docs',
        '-b',
        'Docs',
        '--format',
        'html',
        '--dry-run',
      ]);
    });

    expect(importCalls.length).toBe(1);
    expect(importCalls[0].source).toBe('./docs');
    expect(importCalls[0].opts.book).toBe('Docs');
    expect(importCalls[0].opts.format).toBe('html');
    expect(importCalls[0].opts.dryRun).toBe(true);
    expect(constructedConfigs.length).toBe(1);
    expect(constructedConfigs[0]).toEqual({
      baseUrl: 'https://mock',
      tokenId: 'id',
      tokenSecret: 'secret',
    });
    expect(output).toContain('Import stub executed for ./docs');
  });
});

describe('Book export command', () => {
  it('writes exported book text to the default file path', async () => {
    const writes: Array<{ path: string; data: any; encoding?: string }> = [];
    const exportCalls: Array<{ id: number; format: string }> = [];

    mock.module(new URL('../src/config.ts', import.meta.url).href, () => ({
      resolveConfig: async () => ({ url: 'https://mock', tokenId: 'id', tokenSecret: 'secret' }),
      redact: (cfg: any) => cfg,
    }));

    const { formatBytes, formatDuration } = await import('../src/ui');
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({
        start() { return this; },
        succeed() { return this; },
        fail() { return this; },
        stop() {},
      }),
      formatBytes,
      formatDuration,
    }));

    mock.module('fs-extra', () => ({
      writeFile: async (path: string, data: any, encoding?: string) => {
        writes.push({ path, data, encoding });
      },
      ensureDir: async () => {},
    }));

    mock.module(new URL('../src/bookstack-client.ts', import.meta.url).href, () => ({
      BookStackClient: class {
        constructor(_: any) {}
        async findBookByName(name: string) {
          return name === 'Docs' ? { id: 21 } : null;
        }
        async getBook(id: number) {
          return { id, slug: 'docs' } as any;
        }
        async exportBook(id: number, format: string) {
          exportCalls.push({ id, format });
          return `Exported ${format} for ${id}`;
        }
      },
    }));

    const program = await loadProgram();
    const output = await withCapturedStdout(async () => {
      await program.parseAsync([
        'node',
        'bookstack',
        'book',
        'export',
        'Docs',
        '--format',
        'markdown',
      ]);
    });

    expect(exportCalls).toEqual([{ id: 21, format: 'markdown' }]);
    expect(writes).toEqual([
      { path: 'docs.md', data: 'Exported markdown for 21', encoding: 'utf8' },
    ]);
    expect(output).toContain('Saved markdown export to docs.md');
  });

  it('writes PDF exports to the provided output path', async () => {
    const writes: Array<{ path: string; data: any; encoding?: string }> = [];
    const pdfCalls: Array<{ id: number }> = [];

    mock.module(new URL('../src/config.ts', import.meta.url).href, () => ({
      resolveConfig: async () => ({ url: 'https://mock', tokenId: 'id', tokenSecret: 'secret' }),
      redact: (cfg: any) => cfg,
    }));

    const { formatBytes, formatDuration } = await import('../src/ui');
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({
        start() { return this; },
        succeed() { return this; },
        fail() { return this; },
        stop() {},
      }),
      formatBytes,
      formatDuration,
    }));

    mock.module('fs-extra', () => ({
      writeFile: async (path: string, data: any, encoding?: string) => {
        writes.push({ path, data, encoding });
      },
      ensureDir: async () => {},
    }));

    const bytes = new Uint8Array([1, 2, 3, 4]);

    mock.module(new URL('../src/bookstack-client.ts', import.meta.url).href, () => ({
      BookStackClient: class {
        constructor(_: any) {}
        async getBook(id: number) {
          return { id, slug: 'docs' } as any;
        }
        async exportBookPdf(id: number) {
          pdfCalls.push({ id });
          return bytes;
        }
      },
    }));

    const program = await loadProgram();
    const output = await withCapturedStdout(async () => {
      await program.parseAsync([
        'node',
        'bookstack',
        'book',
        'export',
        '42',
        '--format',
        'pdf',
        '--out',
        './exports/out.pdf',
      ]);
    });

    expect(pdfCalls).toEqual([{ id: 42 }]);
    expect(writes).toEqual([
      { path: './exports/out.pdf', data: bytes, encoding: undefined },
    ]);
    expect(output).toContain('Saved PDF export to ./exports/out.pdf');
  });
});
