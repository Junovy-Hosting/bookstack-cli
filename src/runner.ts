// Embed version into env for compiled binary fallback
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../package.json');
  if (pkg?.version) {
    process.env.BOOKSTACK_CLI_VERSION = pkg.version;
  }
} catch {}

import { program } from './bookstack-cli';
program.parse();
