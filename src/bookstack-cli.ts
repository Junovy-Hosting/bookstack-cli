#!/usr/bin/env node

import { Command } from 'commander';
import { BookStackClient } from './bookstack-client';
import { ImportCommand } from './commands/import';
import * as fs from 'fs-extra';
import * as path from 'path';

const program = new Command();

program
  .name('bookstack-cli')
  .description('An Automated CLI for importing content into BookStack')
  .version('1.0.0');

// Global options
program
  .option('-u, --url <url>', 'BookStack base URL')
  .option('-i, --token-id <id>', 'BookStack API token ID')
  .option('-s, --token-secret <secret>', 'BookStack API token secret')
  .option('-c, --config <path>', 'Config file path', './bookstack-config.json');

// Import command
program
  .command('import')
  .description('Import content into BookStack')
  .argument('<source>', 'Source file or directory to import')
  .option('-b, --book <name>', 'Target book name or ID')
  .option('-f, --format <format>', 'Source format (markdown, html, json)', 'markdown')
  .option('--dry-run', 'Show what would be imported without making changes')
  .action(async (source, options) => {
    try {
      const config = await loadConfig(program.opts().config);
      const globalOpts = program.opts();
      
      const client = new BookStackClient({
        baseUrl: globalOpts.url || config.url,
        tokenId: globalOpts.tokenId || config.tokenId,
        tokenSecret: globalOpts.tokenSecret || config.tokenSecret,
      });

      const importCmd = new ImportCommand(client);
      await importCmd.execute(source, {
        ...options,
        ...globalOpts
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List BookStack resources')
  .argument('<resource>', 'Resource type (books, chapters, pages)')
  .option('--book <id>', 'Book ID to filter by (for chapters/pages)')
  .action(async (resource, options) => {
    try {
      const config = await loadConfig(program.opts().config);
      const globalOpts = program.opts();
      
      const client = new BookStackClient({
        baseUrl: globalOpts.url || config.url,
        tokenId: globalOpts.tokenId || config.tokenId,
        tokenSecret: globalOpts.tokenSecret || config.tokenSecret,
      });

      switch (resource) {
        case 'books':
          const books = await client.getBooks();
          console.log('Books:');
          books.forEach(book => {
            console.log(`  ${book.id}: ${book.name} (${book.slug})`);
          });
          break;
        case 'chapters':
          if (!options.book) {
            console.error('--book option is required for listing chapters');
            process.exit(1);
          }
          const chapters = await client.getChapters(parseInt(options.book));
          console.log(`Chapters in book ${options.book}:`);
          chapters.forEach(chapter => {
            console.log(`  ${chapter.id}: ${chapter.name} (${chapter.slug})`);
          });
          break;
        case 'pages':
          const pages = options.book 
            ? await client.getPages(parseInt(options.book))
            : await client.getAllPages();
          console.log(options.book ? `Pages in book ${options.book}:` : 'All pages:');
          pages.forEach(page => {
            console.log(`  ${page.id}: ${page.name} (${page.slug})`);
          });
          break;
        default:
          console.error(`Unknown resource type: ${resource}`);
          console.error('Available types: books, chapters, pages');
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .argument('<action>', 'Action (init, show)')
  .action(async (action) => {
    const configPath = program.opts().config;
    
    switch (action) {
      case 'init':
        const defaultConfig = {
          url: 'https://your-bookstack-instance.com',
          tokenId: 'your-token-id',
          tokenSecret: 'your-token-secret'
        };
        
        if (await fs.pathExists(configPath)) {
          console.log(`Config file already exists at ${configPath}`);
        } else {
          await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
          console.log(`Created config file at ${configPath}`);
          console.log('Please edit the file with your BookStack credentials.');
        }
        break;
      case 'show':
        try {
          const config = await loadConfig(configPath);
          console.log('Current configuration:');
          console.log(`  URL: ${config.url || 'Not set'}`);
          console.log(`  Token ID: ${config.tokenId ? '[SET]' : 'Not set'}`);
          console.log(`  Token Secret: ${config.tokenSecret ? '[SET]' : 'Not set'}`);
        } catch (error) {
          console.error(`Config file not found at ${configPath}`);
          console.error('Run "bookstack-cli config init" to create one.');
        }
        break;
      default:
        console.error(`Unknown action: ${action}`);
        console.error('Available actions: init, show');
        process.exit(1);
    }
  });

async function loadConfig(configPath: string): Promise<any> {
  try {
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
  } catch (error) {
    // Config file doesn't exist or is invalid
  }
  return {};
}

// Parse arguments and run
if (require.main === module) {
  program.parse();
}

export { program };