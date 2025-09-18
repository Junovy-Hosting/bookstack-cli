import * as fs from 'fs-extra';
import * as path from 'path';
import { BookStackClient, Book, Page } from '../bookstack-client';

export interface ImportOptions {
  book?: string;
  format?: string;
  dryRun?: boolean;
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
      console.log('Testing BookStack connection...');
      const connected = await this.client.testConnection();
      if (!connected) {
        throw new Error('Failed to connect to BookStack. Please check your configuration.');
      }
      console.log('Connection successful!');
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

    console.log('Import completed!');
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
    const bookName = options.book || path.basename(dirPath);
    const targetBook = await this.getTargetBook(bookName, options.dryRun);
    
    console.log(`Processing directory as book: ${targetBook.name}`);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isFile() && this.isSupportedFile(item)) {
        const fileName = path.basename(item, path.extname(item));
        const content = await fs.readFile(itemPath, 'utf-8');
        
        console.log(`  Processing file: ${fileName}`);

        const pageData = {
          book_id: targetBook.id,
          name: fileName,
          html: this.convertToHtml(content, options.format || this.detectFormat(item)),
          markdown: this.detectFormat(item) === 'markdown' ? content : undefined,
        };

        if (options.dryRun) {
          console.log(`    Would create page: ${pageData.name}`);
        } else {
          const page = await this.client.createPage(pageData);
          console.log(`    Created page: ${page.name} (ID: ${page.id})`);
        }
      } else if (stats.isDirectory()) {
        // Recursive directory import could be added here
        console.log(`  Skipping subdirectory: ${item} (not implemented)`);
      }
    }
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