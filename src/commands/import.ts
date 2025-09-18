import * as fs from 'fs-extra';
import * as path from 'path';
import { BookStackClient, Book, Page } from '../bookstack-client';
import { createSpinner, createProgressBar, c } from '../ui';

export interface ImportOptions {
  book?: string;
  format?: string;
  dryRun?: boolean;
  maxDepth?: number; // max recursion within subdirectories (default: 10)
  chapterFrom?: 'dir' | 'readme'; // naming source if no metadata
  flatten?: boolean; // import all files into book directly
}

export class ImportCommand {
  constructor(private client: BookStackClient) {}

  async execute(source: string, options: ImportOptions): Promise<void> {
    console.log(`Importing from: ${source}`);
    console.log(`Format: ${options.format || 'markdown'}`);
    console.log(`Target book: ${options.book || 'auto-detect'}`);
    
    if (options.dryRun) {
      console.log('DRY RUN MODE - No changes will be made');
    }

    // Test connection first (skip in dry run mode)
    if (!options.dryRun) {
      const spin = createSpinner('Testing BookStack connection…').start();
      const connected = await this.client.testConnection();
      if (!connected) {
        spin.fail('Failed to connect to BookStack');
        throw new Error('Failed to connect to BookStack. Please check your configuration.');
      }
      spin.succeed('Connection successful');
    }

    const sourcePath = path.resolve(source);
    
    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    const stats = await fs.stat(sourcePath);
    
    if (stats.isFile()) {
      await this.importFile(sourcePath, options);
    } else if (stats.isDirectory()) {
      await this.importDirectory(sourcePath, options);
    } else {
      throw new Error('Source must be a file or directory');
    }

    console.log(c.green('Import completed!'));
  }

  private async importFile(filePath: string, options: ImportOptions): Promise<void> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const content = await fs.readFile(filePath, 'utf-8');
    
    console.log(`Processing file: ${fileName}`);

    const targetBook = await this.getTargetBook(options.book || fileName, options.dryRun);
    
    const pageData = {
      book_id: targetBook.id,
      name: fileName,
      html: this.convertToHtml(content, options.format || 'markdown'),
      markdown: options.format === 'markdown' ? content : undefined,
    };

    if (options.dryRun) {
      console.log(`  Would create page: ${pageData.name} in book: ${targetBook.name}`);
      console.log(`  Content length: ${content.length} characters`);
    } else {
      const page = await this.client.createPage(pageData);
      console.log(`  Created page: ${page.name} (ID: ${page.id})`);
    }
  }

  private async importDirectory(dirPath: string, options: ImportOptions): Promise<void> {
    const items = await fs.readdir(dirPath);
    const bookMeta = await this.readBookMetadata(dirPath);
    const bookName = options.book || bookMeta.name || path.basename(dirPath);
    const targetBook = await this.getTargetBook(bookName, options.dryRun);
    if (!options.dryRun && bookMeta.description) {
      try { await this.client.updateBook(targetBook.id, { description: bookMeta.description }); } catch {}
    }
    console.log(c.bold(`Processing directory as book: ${targetBook.name}`));

    const total = await this.countFiles(dirPath, options);
    const bar = createProgressBar(total, 'Importing');

    const maxDepth = Number.isFinite(options.maxDepth as number) ? (options.maxDepth as number) : 10;
    const chapterFrom = (options.chapterFrom || 'dir');
    const flatten = !!options.flatten;

    // First, import files directly in the root directory as book pages
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      if (stats.isFile() && this.isSupportedFile(item)) {
        await this.createPageInBook(targetBook.id, itemPath, item, options);
        bar.tick(1);
      }
    }

    // Now handle first-level subdirectories
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      if (!stats.isDirectory()) continue;

      if (flatten) {
        console.log(`  Flattening subdirectory: ${item} (pages go directly under book)`);
        await this.walkFiles(itemPath, maxDepth - 1, async (filePath, relName) => {
          if (!this.isSupportedFile(filePath)) return;
          await this.createPageInBook(targetBook.id, filePath, path.basename(filePath), options);
          bar.tick(1);
        });
        continue;
      }

      const chapterMeta = await this.readChapterMetadata(itemPath);
      let chapterName = chapterMeta.name;
      if (!chapterName) {
        if (chapterFrom === 'readme') {
          chapterName = await this.deriveNameFromReadme(itemPath);
        }
        if (!chapterName) {
          chapterName = item;
        }
      }

      const chapter = await this.getOrCreateChapter(targetBook.id, chapterName, chapterMeta.description || '', !!options.dryRun);
      console.log(`  Using chapter: ${chapterName} (Book ID: ${targetBook.id})`);

      // Import files within this subdirectory into the chapter
      await this.walkFiles(itemPath, maxDepth - 1, async (filePath, relName) => {
        if (!this.isSupportedFile(filePath)) return;
        await this.createPageInChapter(targetBook.id, chapter.id, filePath, path.basename(filePath), options);
        bar.tick(1);
      });
    }
    bar.stop('\n');
  }

  private async countFiles(dirPath: string, options: ImportOptions): Promise<number> {
    const items = await fs.readdir(dirPath);
    let total = 0;
    for (const item of items) {
      const p = path.join(dirPath, item);
      const st = await fs.stat(p);
      if (st.isFile() && this.isSupportedFile(item)) total++;
    }
    const maxDepth = Number.isFinite(options.maxDepth as number) ? (options.maxDepth as number) : 10;
    for (const item of items) {
      const p = path.join(dirPath, item);
      const st = await fs.stat(p);
      if (!st.isDirectory()) continue;
      await this.walkFiles(p, maxDepth - 1, async (file) => { if (this.isSupportedFile(file)) total++; });
    }
    return total;
  }

  private async createPageInBook(bookId: number, filePath: string, displayName: string, options: ImportOptions) {
    const fileName = path.basename(displayName, path.extname(displayName));
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`  Processing file: ${fileName}`);
    const fmt = options.format || this.detectFormat(filePath);
    const pageData = {
      book_id: bookId,
      name: fileName,
      html: this.convertToHtml(content, fmt),
      markdown: fmt === 'markdown' ? content : undefined,
    } as Partial<Page>;
    if (options.dryRun) {
      console.log(`    Would create page in book: ${pageData.name}`);
    } else {
      const page = await this.client.createPage(pageData);
      console.log(`    Created page: ${page.name} (ID: ${page.id})`);
    }
  }

  private async createPageInChapter(bookId: number, chapterId: number, filePath: string, displayName: string, options: ImportOptions) {
    const fileName = path.basename(displayName, path.extname(displayName));
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`    Processing file: ${fileName}`);
    const fmt = options.format || this.detectFormat(filePath);
    const pageData = {
      book_id: bookId,
      chapter_id: chapterId,
      name: fileName,
      html: this.convertToHtml(content, fmt),
      markdown: fmt === 'markdown' ? content : undefined,
    } as Partial<Page>;
    if (options.dryRun) {
      console.log(`      Would create page in chapter: ${pageData.name}`);
    } else {
      const page = await this.client.createPage(pageData);
      console.log(`      Created page: ${page.name} (ID: ${page.id})`);
    }
  }

  private async getOrCreateChapter(bookId: number, name: string, description: string, dryRun: boolean) {
    if (dryRun) {
      return { id: 1, name, slug: name.toLowerCase().replace(/\s+/g, '-'), book_id: bookId, priority: 0, created_at: '', updated_at: '' } as any;
    }
    const existing = await this.client.getChapters(bookId);
    const found = existing.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    return await this.client.createChapter(bookId, { name, description });
  }

  private async readChapterMetadata(dir: string): Promise<{ name?: string; description?: string }> {
    const metaPath = path.join(dir, '.chapter-metadata.json');
    try {
      if (await fs.pathExists(metaPath)) {
        const data = JSON.parse(await fs.readFile(metaPath, 'utf8')) as { name?: string; description?: string };
        return { name: data.name, description: data.description };
      }
    } catch (e) {
      console.warn(`  Warning: failed to parse ${metaPath}: ${(e as Error).message}`);
    }
    return {};
  }

  private async readBookMetadata(dir: string): Promise<{ name?: string; description?: string }> {
    const metaPath = path.join(dir, '.book-metadata.json');
    try {
      if (await fs.pathExists(metaPath)) {
        const data = JSON.parse(await fs.readFile(metaPath, 'utf8')) as { name?: string; description?: string };
        return { name: data.name, description: data.description };
      }
    } catch (e) {
      console.warn(`Warning: failed to parse ${metaPath}: ${(e as Error).message}`);
    }
    return {};
  }

  private async deriveNameFromReadme(dir: string): Promise<string | undefined> {
    const candidates = ['README.md', 'Readme.md', 'readme.md', 'index.md'];
    for (const c of candidates) {
      const p = path.join(dir, c);
      if (await fs.pathExists(p)) {
        const content = await fs.readFile(p, 'utf8');
        // Try first Markdown heading
        const m = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m) || content.match(/^###\s+(.+)$/m);
        if (m && m[1]) return m[1].trim();
        // Fallback: first non-empty line
        const line = content.split(/\r?\n/).find(l => l.trim().length > 0);
        if (line) return line.trim();
      }
    }
    return undefined;
  }

  private async walkFiles(root: string, depth: number, onFile: (filePath: string, relName: string) => Promise<void>) {
    async function walk(current: string, currentDepth: number) {
      const entries = await fs.readdir(current);
      for (const ent of entries) {
        const p = path.join(current, ent);
        const st = await fs.stat(p);
        if (st.isDirectory()) {
          if (currentDepth > 0) {
            await walk(p, currentDepth - 1);
          }
        } else if (st.isFile()) {
          await onFile(p, path.relative(root, p));
        }
      }
    }
    await walk(root, Math.max(0, depth));
  }

  private async getTargetBook(bookName: string, dryRun: boolean = false): Promise<Book> {
    console.log(`Looking for book: ${bookName}`);
    
    if (dryRun) {
      // In dry-run mode, return a mock book
      return {
        id: 1,
        name: bookName,
        slug: bookName.toLowerCase().replace(/\s+/g, '-'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    // Try to find by name or ID
    let book: Book | null = null;
    
    if (/^\d+$/.test(bookName)) {
      // It's a numeric ID
      try {
        book = await this.client.getBook(parseInt(bookName));
      } catch (error) {
        // Book with ID not found
      }
    }
    
    if (!book) {
      // Try to find by name
      book = await this.client.findBookByName(bookName);
    }
    
    if (!book) {
      console.log(`Book not found, creating new book: ${bookName}`);
      book = await this.client.createBook({
        name: bookName,
        description: `Book created by bookstack-cli import`
      });
      console.log(`Created book: ${book.name} (ID: ${book.id})`);
    } else {
      console.log(`Using existing book: ${book.name} (ID: ${book.id})`);
    }
    
    return book;
  }

  private isSupportedFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return ['.md', '.markdown', '.html', '.htm', '.txt'].includes(ext);
  }

  private detectFormat(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    switch (ext) {
      case '.md':
      case '.markdown':
        return 'markdown';
      case '.html':
      case '.htm':
        return 'html';
      default:
        return 'markdown'; // Default to markdown
    }
  }

  private convertToHtml(content: string, format: string): string {
    switch (format) {
      case 'html':
        return content;
      case 'markdown':
        // Simple markdown to HTML conversion (basic)
        return this.simpleMarkdownToHtml(content);
      default:
        // Treat as plain text
        return `<pre>${this.escapeHtml(content)}</pre>`;
    }
  }

  private simpleMarkdownToHtml(markdown: string): string {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraphs if not already wrapped
    if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>')) {
      html = `<p>${html}</p>`;
    }
    
    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
