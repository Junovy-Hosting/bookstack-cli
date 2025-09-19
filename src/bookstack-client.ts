import axios, { AxiosInstance } from 'axios';

export interface BookStackConfig {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
}

export interface Book {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: number;
  book_id: number;
  name: string;
  slug: string;
  description?: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: number;
  book_id: number;
  chapter_id?: number;
  name: string;
  slug: string;
  html?: string;
  markdown?: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Shelf {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  books?: Book[];
}

export interface SearchResult {
  id: number;
  name: string;
  slug: string;
  type: 'book' | 'chapter' | 'page' | string;
  url?: string;
  book_id?: number;
  chapter_id?: number;
}

export interface ImageItem {
  id: number;
  name: string;
  url?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  uploaded_to?: number;
}

export class BookStackClient {
  private client: AxiosInstance;
  private config: BookStackConfig;

  constructor(config: BookStackConfig) {
    this.config = config;
    
    if (!config.baseUrl || !config.tokenId || !config.tokenSecret) {
      throw new Error('BookStack configuration is incomplete. Please provide baseUrl, tokenId, and tokenSecret.');
    }

    this.client = axios.create({
      baseURL: `${config.baseUrl}/api`,
      headers: {
        'Authorization': `Token ${config.tokenId}:${config.tokenSecret}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Books API
  async getBooks(): Promise<Book[]> {
    const response = await this.client.get('/books');
    return response.data.data;
  }

  async getBook(id: number): Promise<Book> {
    const response = await this.client.get(`/books/${id}`);
    return response.data;
  }

  async createBook(data: Partial<Book>): Promise<Book> {
    const response = await this.client.post('/books', data);
    return response.data;
  }

  async updateBook(id: number, data: Partial<Book>): Promise<Book> {
    const response = await this.client.put(`/books/${id}`, data);
    return response.data;
  }

  // Chapters API
  async getChapters(bookId: number): Promise<Chapter[]> {
    // BookStack API exposes chapters via the book read endpoint contents
    const contents = await this.getBookContents(bookId);
    const chapters = contents
      .filter((item: any) => item.type === 'chapter')
      .map((item: any) => ({
        id: item.id,
        book_id: item.book_id ?? bookId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        priority: item.priority ?? 0,
        created_at: item.created_at ?? '',
        updated_at: item.updated_at ?? '',
      })) as Chapter[];
    return chapters;
  }

  async getChapter(id: number): Promise<Chapter> {
    const response = await this.client.get(`/chapters/${id}`);
    return response.data;
  }

  async createChapter(bookId: number, data: Partial<Chapter>): Promise<Chapter> {
    const response = await this.client.post('/chapters', { ...data, book_id: bookId });
    return response.data;
  }

  async updateChapter(id: number, data: Partial<Chapter>): Promise<Chapter> {
    const response = await this.client.put(`/chapters/${id}`, data);
    return response.data;
  }

  // Pages API
  async getAllPages(): Promise<Page[]> {
    const response = await this.client.get('/pages');
    return response.data.data;
  }

  async getPages(bookId: number): Promise<Page[]> {
    // Combine top-level pages and chapter-contained pages from book contents
    const contents = await this.getBookContents(bookId);
    const topLevelPages = contents
      .filter((item: any) => item.type === 'page')
      .map((p: any) => ({
        id: p.id,
        book_id: p.book_id ?? bookId,
        chapter_id: p.chapter_id ?? undefined,
        name: p.name,
        slug: p.slug,
        priority: p.priority ?? 0,
        created_at: p.created_at ?? '',
        updated_at: p.updated_at ?? '',
      }));

    const chapterPages = contents
      .filter((item: any) => item.type === 'chapter')
      .flatMap((ch: any) => (Array.isArray(ch.pages) ? ch.pages : []))
      .map((p: any) => ({
        id: p.id,
        book_id: p.book_id ?? bookId,
        chapter_id: p.chapter_id ?? undefined,
        name: p.name,
        slug: p.slug,
        priority: p.priority ?? 0,
        created_at: p.created_at ?? '',
        updated_at: p.updated_at ?? '',
      }));

    return [...topLevelPages, ...chapterPages] as Page[];
  }

  async getPage(id: number): Promise<Page> {
    const response = await this.client.get(`/pages/${id}`);
    return response.data;
  }

  async createPage(data: Partial<Page>): Promise<Page> {
    const response = await this.client.post('/pages', data);
    return response.data;
  }

  async updatePage(id: number, data: Partial<Page>): Promise<Page> {
    const response = await this.client.put(`/pages/${id}`, data);
    return response.data;
  }

  async deletePage(id: number): Promise<void> {
    await this.client.delete(`/pages/${id}`);
  }

  // Utility methods
  async findBookByName(name: string): Promise<Book | null> {
    const books = await this.getBooks();
    return books.find(book => 
      book.name.toLowerCase() === name.toLowerCase() || 
      book.slug.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  async findOrCreateBook(name: string): Promise<Book> {
    const existing = await this.findBookByName(name);
    if (existing) {
      return existing;
    }

    return await this.createBook({
      name,
      description: `Book created by bookstack-cli`
    });
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/books');
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getBookContents(bookId: number): Promise<any[]> {
    const response = await this.client.get(`/books/${bookId}`);
    const data = response.data || {};
    return (data.contents || data.content || []) as any[];
  }

  // Book export API
  async exportBook(bookId: number, format: 'html' | 'markdown' | 'plaintext'): Promise<string> {
    const path = `/books/${bookId}/export/${format}`;
    const res = await this.client.get(path, { responseType: 'text' });
    return typeof res.data === 'string' ? res.data : String(res.data);
  }

  async exportBookPdf(bookId: number): Promise<Uint8Array> {
    const res = await this.client.get(`/books/${bookId}/export/pdf`, { responseType: 'arraybuffer' });
    return new Uint8Array(res.data as ArrayBuffer);
  }

  // Chapter export API
  async exportChapter(chapterId: number, format: 'html' | 'markdown' | 'plaintext'): Promise<string> {
    const path = `/chapters/${chapterId}/export/${format}`;
    const res = await this.client.get(path, { responseType: 'text' });
    return typeof res.data === 'string' ? res.data : String(res.data);
  }

  async exportChapterPdf(chapterId: number): Promise<Uint8Array> {
    const res = await this.client.get(`/chapters/${chapterId}/export/pdf`, { responseType: 'arraybuffer' });
    return new Uint8Array(res.data as ArrayBuffer);
  }

  // Page export API
  async exportPage(pageId: number, format: 'html' | 'markdown' | 'plaintext'): Promise<string> {
    const path = `/pages/${pageId}/export/${format}`;
    const res = await this.client.get(path, { responseType: 'text' });
    return typeof res.data === 'string' ? res.data : String(res.data);
  }

  async exportPagePdf(pageId: number): Promise<Uint8Array> {
    const res = await this.client.get(`/pages/${pageId}/export/pdf`, { responseType: 'arraybuffer' });
    return new Uint8Array(res.data as ArrayBuffer);
  }

  // Shelves
  async getShelves(): Promise<Shelf[]> {
    const response = await this.client.get('/shelves');
    return response.data.data;
  }

  async getShelf(id: number): Promise<Shelf> {
    const response = await this.client.get(`/shelves/${id}`);
    return response.data;
  }

  // Search
  async searchAll(query: string): Promise<SearchResult[]> {
    const response = await this.client.get('/search', { params: { query } });
    const results = (response.data?.data || response.data || []) as any[];
    return results.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      type: r.type,
      url: r.url,
      book_id: r.book_id,
      chapter_id: r.chapter_id,
    }));
  }

  // Images (Image Gallery)
  async getImages(): Promise<ImageItem[]> {
    const res = await this.client.get('/image-gallery');
    const arr = (res.data?.data || res.data || []) as any[];
    return arr.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      type: r.type,
      created_at: r.created_at,
      updated_at: r.updated_at,
      uploaded_to: r.uploaded_to,
    }));
  }

  async getImage(id: number): Promise<ImageItem> {
    const res = await this.client.get(`/image-gallery/${id}`);
    const r = res.data;
    return {
      id: r.id,
      name: r.name,
      url: r.url,
      type: r.type,
      created_at: r.created_at,
      updated_at: r.updated_at,
      uploaded_to: r.uploaded_to,
    };
  }
}
