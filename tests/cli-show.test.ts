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

function mockClient(overrides: Partial<Record<string, any>> = {}) {
  class StubClient {
    constructor(_: any) {}
    async findBookByName(q: string) { return q === 'DocBook' ? { id: 999 } : null; }
    async getBook(id: number) {
      return {
        id, slug: 'docbook', name: 'Doc Book', description: 'Docs description',
        contents: [
          { type: 'page', id: 101, slug: 'intro', name: 'Intro' },
          { type: 'chapter', id: 201, slug: 'ch-one', name: 'Chapter One', pages: [
            { id: 301, slug: 'pg-a', name: 'Nested Page' }
          ]}
        ]
      } as any;
    }
    async getChapter(id: number) { return { id, slug: 'ch-one', name: 'Chapter One', description: 'Chapter details', book_id: 999 } as any; }
    async getPage(id: number) { return { id, slug: 'pg-a', name: 'Page A', book_id: 999, chapter_id: 10 } as any; }
    async getPages(bookId: number) {
      return [
        { id: 301, slug: 'pg-a', name: 'Page A', book_id: bookId, chapter_id: 10 },
        { id: 401, slug: 'pg-b', name: 'Other Chapter Page', book_id: bookId, chapter_id: 11 },
      ];
    }
    async getShelf(id: number) { return { id, slug: 'primary', name: 'Primary', description: 'Top shelf', books: [ { id: 999, name: 'Doc Book', slug: 'docbook' } ] } as any; }
    async getShelves() { return [ { id: 42, name: 'Primary', slug: 'primary' } ]; }
    async getImage(id: number) { return { id, name: 'Logo', type: 'image', url: 'https://mock/img/7', created_at: '2024-01-01', updated_at: '2024-02-01', uploaded_to: null } as any; }
    async searchAll(_q: string) { return []; }
  }
  Object.assign(StubClient.prototype, overrides);
  mock.module(new URL('../src/bookstack-client.ts', import.meta.url).href, () => ({ BookStackClient: StubClient }));
}

async function loadProgram() {
  const mod = await import(new URL('../src/bookstack-cli.ts', import.meta.url).href);
  return mod.program as import('../src/bookstack-cli').program;
}

beforeEach(() => { mock.restore(); });
afterEach(() => { mock.restore(); });

describe('Single-resource commands', () => {
  it('book show <name> (human) prints header, pages, and chapters', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'book', 'show', 'DocBook']);
    });
    expect(out).toContain('Doc Book');
    expect(out).toContain('#999');
    expect(out).toContain('Top‑level Pages');
    expect(out).toContain('Intro');
    expect(out).toContain('Chapter One');
    expect(out).toContain('Nested Page');
  });

  it('book show <name> --json outputs structured JSON', async () => {
    // Prevent quiet mode from silencing console.log when --json is used
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({ start() { return this; }, succeed() { return this; }, fail() { return this; }, stop() {} }),
    }));
    mockClient();
    const program = await loadProgram();
    const jsonStr = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'book', 'show', 'DocBook', '--json']);
    });
    const data = JSON.parse(jsonStr);
    expect(data.id).toBe(999);
    expect(data.slug).toBe('docbook');
    expect(Array.isArray(data.top_level_pages)).toBe(true);
    expect(data.chapters[0].pages[0].slug).toBe('pg-a');
  });

  it('chapter show <id> (human) prints details and pages', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'chapter', 'show', '10']);
    });
    expect(out).toContain('Chapter One');
    expect(out).toContain('#10');
    expect(out).toContain('Pages');
    expect(out).toContain('Page A');
  });

  it('chapter show <id> --json outputs structured JSON', async () => {
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({ start() { return this; }, succeed() { return this; }, fail() { return this; }, stop() {} }),
    }));
    mockClient();
    const program = await loadProgram();
    const jsonStr = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'chapter', 'show', '10', '--json']);
    });
    const data = JSON.parse(jsonStr);
    expect(data.id).toBe(10);
    expect(data.slug).toBe('ch-one');
    expect(Array.isArray(data.pages)).toBe(true);
    expect(data.pages[0].name).toBe('Page A');
  });

  it('page show <id> (human) prints details', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'page', 'show', '301']);
    });
    expect(out).toContain('Page A');
    expect(out).toContain('#301');
    expect(out).toContain('Book: 999');
    expect(out).toContain('Chapter');
  });

  it('page show <id> --json outputs structured JSON', async () => {
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({ start() { return this; }, succeed() { return this; }, fail() { return this; }, stop() {} }),
    }));
    mockClient();
    const program = await loadProgram();
    const jsonStr = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'page', 'show', '301', '--json']);
    });
    const data = JSON.parse(jsonStr);
    expect(data.id).toBe(301);
    expect(data.slug).toBe('pg-a');
    expect(data.book_id).toBe(999);
    expect(data.chapter_id).toBe(10);
  });

  it('shelves show <id> prints shelf details and books', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'shelves', 'show', '42']);
    });
    expect(out).toContain('Primary (ID: 42, slug: primary)');
    expect(out).toContain('Books:');
    expect(out).toContain('999: Doc Book (docbook)');
  });

  it('images read <id> prints details and supports --json', async () => {
    // Human
    mockClient();
    let program = await loadProgram();
    let out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'images', 'read', '7']);
    });
    expect(out).toContain('Logo');
    expect(out).toContain('#7');
    expect(out).toContain('https://mock/img/7');

    // JSON
    mock.restore();
    mockClient();
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({ start() { return this; }, succeed() { return this; }, fail() { return this; }, stop() {} }),
    }));
    program = await loadProgram();
    const jsonOut = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'images', 'read', '7', '--json']);
    });
    const img = JSON.parse(jsonOut);
    expect(img.id).toBe(7);
    expect(img.url).toContain('/img/7');
    expect(img.type).toBe('image');
  });
});

