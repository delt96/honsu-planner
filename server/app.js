import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemsRouter } from './routes/items.js';
import { candidatesRouter } from './routes/candidates.js';
import { summaryRouter } from './routes/summary.js';
import { roomsRouter } from './routes/rooms.js';
import { placementsRouter } from './routes/placements.js';
import { layoutRouter } from './routes/layout.js';
import { homeSettingsRouter } from './routes/home-settings.js';

export function createApp(pool) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api', itemsRouter(pool));
  app.use('/api', candidatesRouter(pool));
  app.use('/api', summaryRouter(pool));
  app.use('/api', roomsRouter(pool));
  app.use('/api', placementsRouter(pool));
  app.use('/api', layoutRouter(pool));
  app.use('/api', homeSettingsRouter(pool));

  const webDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
