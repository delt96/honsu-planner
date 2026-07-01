import express from 'express';
import * as home from '../queries/home-settings.js';
import { normalizeHomeSettings } from '../validation.js';

export function homeSettingsRouter(pool) {
  const r = express.Router();

  r.get('/home-settings', async (req, res, next) => {
    try { res.json(await home.getHomeSettings(pool)); } catch (e) { next(e); }
  });

  r.put('/home-settings', async (req, res, next) => {
    try {
      const { errors, value } = normalizeHomeSettings(req.body ?? {});
      if (errors.length) return res.status(400).json({ error: errors.join(', ') });
      const updated = await home.saveHomeSettings(pool, value);
      if (!updated) return res.status(404).json({ error: 'Home settings not found' });
      res.json(updated);
    } catch (e) { next(e); }
  });

  return r;
}
