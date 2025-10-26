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
    async getShelves() { return [ { id: 1, name: 'Shelf One', slug: 'shelf-one' }, { id: 2, name: 'Shelf Two', slug: 'shelf-two' } ]; }
    async getBooks() { return [ { id: 3, name: 'Book A', slug: 'book-a' }, { id: 4, name: 'Book B', slug: 'book-b' } ]; }
    async getChapters(bookId: number) { return [ { id: 10, name: `Ch One (b${bookId})`, slug: 'ch-one' } ]; }
    async getPages(bookId: number) { return [ { id: 20, name: `Pg One (b${bookId})`, slug: 'pg-one' } ]; }
    async getAllPages() { return [ { id: 21, name: 'Pg Any', slug: 'pg-any' } ]; }
    async getImages() { return [ { id: 7, name: 'Logo', type: 'image', url: 'https://mock/img/7' } ]; }
    async findBookByName(q: string) { return q === 'DocBook' ? { id: 999 } : null; }
  }
  Object.assign(StubClient.prototype, overrides);
  mock.module(new URL('../src/bookstack-client.ts', import.meta.url).href, () => ({ BookStackClient: StubClient }));
}

async function loadProgram() {
  // Import after mocks applied so the CLI wires in stubbed modules
  const mod = await import(new URL('../src/bookstack-cli.ts', import.meta.url).href);
  return mod.program as import('../src/bookstack-cli').program;
}

beforeEach(() => {
  mock.restore();
});

afterEach(() => {
  mock.restore();
});

describe('CLI list commands', () => {
  it('lists shelves', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'shelves', 'list']);
    });
    expect(out).toContain('Shelves:');
    expect(out).toContain('1: Shelf One (shelf-one)');
    expect(out).toContain('2: Shelf Two (shelf-two)');
  });

  it('lists books', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'books', 'list']);
    });
    expect(out).toContain('Books:');
    expect(out).toContain('3: Book A (book-a)');
    expect(out).toContain('4: Book B (book-b)');
  });

  it('lists chapters for a book by id', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'chapters', 'list', '--book', '3']);
    });
    expect(out).toContain('Chapters in book 3:');
    expect(out).toContain('10: Ch One (b3) (ch-one)');
  });

  it('lists pages globally when no book specified', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'pages', 'list']);
    });
    expect(out).toContain('All pages:');
    expect(out).toContain('21: Pg Any (pg-any)');
  });

  it('lists pages for a named book', async () => {
    mockClient();
    const program = await loadProgram();
    const out = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'pages', 'list', '--book', 'DocBook']);
    });
    expect(out).toContain('Pages in book DocBook:');
    // resolveBookId should map DocBook -> 999 and thus label contains 999
    expect(out).toContain('Pg One (b999)');
  });

  it('lists images and supports --json', async () => {
    // For --json, the CLI sets quiet which normally silences console.log.
    // Override UI for this test so --json does not mute console.log.
    const { formatBytes, formatDuration } = await import('../src/ui');
    mock.module(new URL('../src/ui.ts', import.meta.url).href, () => ({
      configureUi: () => {},
      c: new Proxy({}, { get: () => (s: any) => String(s) }),
      createSpinner: () => ({ start() { return this; }, succeed() { return this; }, fail() { return this; }, stop() {} }),
      createProgressBar: () => ({ tick() {}, update() {}, stop() {} }),
      formatBytes,
      formatDuration,
    }));
    mockClient();
    const program = await loadProgram();
    // Human output
    const out1 = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'images', 'list']);
    });
    expect(out1).toContain('Images:');
    expect(out1).toContain('Logo');
    // JSON output
    const out2 = await withCapturedStdout(async () => {
      await program.parseAsync(['node', 'bookstack', 'images', 'list', '--json']);
    });
    const parsed = JSON.parse(out2);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe(7);
    expect(parsed[0].url).toContain('/img/7');
  });
});
