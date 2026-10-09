import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests for the chat state, the RPC client, and the gateway helpers. They run in
// plain Node, so nothing here needs a device or a simulator.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': appRoot },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
