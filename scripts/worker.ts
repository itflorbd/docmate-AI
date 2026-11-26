import { config } from 'dotenv';
config();

import { ingestionWorker } from '../src/workers/ingestion-worker';

console.log('====================================================');
console.log('       DocMate AI - Ingestion Background Worker     ');
console.log('====================================================');

ingestionWorker.start().catch((err) => {
  console.error('[Worker CLI] Fatal failure starting worker:', err);
  process.exit(1);
});

const shutdown = () => {
  console.log('\n[Worker CLI] Received termination signal. Shutting down gracefully...');
  ingestionWorker.stop();
  setTimeout(() => process.exit(0), 1000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
