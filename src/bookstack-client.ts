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
    const response = await this.client.get(`/books/${bookId}/chapters`);
    return response.data.data;
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
    const response = await this.client.get(`/books/${bookId}/pages`);
    return response.data.data;
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
}