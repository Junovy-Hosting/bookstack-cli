# Getting Started with BookStack CLI

Welcome to the BookStack Import Bot CLI! This powerful tool allows you to efficiently import content into your BookStack documentation platform.

## What is BookStack CLI?

BookStack CLI is an automated command-line interface that enables you to:

- Import individual files or entire directories
- Convert Markdown and HTML files to BookStack pages
- Manage books, chapters, and pages programmatically
- Batch import documentation with ease

## Prerequisites

Before using the CLI, ensure you have:

1. A running BookStack instance
2. API access enabled in BookStack
3. Valid API token credentials (Token ID and Secret)
4. Node.js installed on your system

## Quick Start

1. **Configure your BookStack connection:**
   ```bash
   npm run dev -- config init
   ```

2. **Edit the configuration file** with your BookStack details:
   ```json
   {
     "url": "https://your-bookstack-instance.com",
     "tokenId": "your-token-id", 
     "tokenSecret": "your-token-secret"
   }
   ```

3. **Test the connection:**
   ```bash
   npm run dev -- list books
   ```

4. **Import your first document:**
   ```bash
   npm run dev -- import my-doc.md --book "Documentation"
   ```

## Next Steps

- Explore the API Reference for detailed command usage
- Try importing a directory of files
- Use dry-run mode to preview imports

Happy documenting! 📚