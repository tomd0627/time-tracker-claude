import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { runMigrations } from './db/migrate';
import { errorHandler, notFound } from './middleware/errorHandler';
import apiRouter from './routes/index';

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// API routes
app.use('/api', apiRouter);

// Serve generated PDFs as static files
app.use('/data', express.static(path.join(process.cwd(), 'data')));

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// Run migrations then start
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

export default app;
