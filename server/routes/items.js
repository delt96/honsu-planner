import express from 'express';
import * as items from '../queries/items.js';
import { validateItemName } from '../validation.js';

export function itemsRouter(pool) {
  const r = express.Router();

  r.get('/items', async (req, res, next) => {
    try { res.json(await items.listItems(pool)); } catch (e) { next(e); }
  });

  r.get('/items/:id', async (req, res, next) => {
    try {
      const item = await items.getItemWithCandidates(pool, Number(req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.json(item);
    } catch (e) { next(e); }
  });

  r.post('/items', async (req, res, next) => {
    try {
      const err = validateItemName(req.body?.name);
      if (err) return res.status(400).json({ error: err });
      res.status(201).json(await items.createItem(pool, { name: req.body.name.trim() }));
    } catch (e) { next(e); }
  });

  r.patch('/items/:id', async (req, res, next) => {
    try {
      const data = {};
      if (req.body?.name !== undefined) {
        const err = validateItemName(req.body.name);
        if (err) return res.status(400).json({ error: err });
        data.name = req.body.name.trim();
      }
      if (req.body?.sort_order !== undefined) data.sort_order = Number(req.body.sort_order);
      const updated = await items.updateItem(pool, Number(req.params.id), data);
      if (!updated) return res.status(404).json({ error: 'Item not found' });
      res.json(updated);
    } catch (e) { next(e); }
  });

  r.delete('/items/:id', async (req, res, next) => {
    try {
      const ok = await items.deleteItem(pool, Number(req.params.id));
      if (!ok) return res.status(404).json({ error: 'Item not found' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  r.put('/items/:id/confirm', async (req, res, next) => {
    try {
      const itemId = Number(req.params.id);
      const candidateId = Number(req.body?.candidate_id);
      if (!Number.isInteger(candidateId)) {
        return res.status(400).json({ error: 'candidate_id is required' });
      }
      const item = await items.getItem(pool, itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const updated = await items.setConfirmed(pool, itemId, candidateId);
      if (!updated) return res.status(400).json({ error: 'Candidate does not belong to this item' });
      res.json(updated);
    } catch (e) { next(e); }
  });

  r.delete('/items/:id/confirm', async (req, res, next) => {
    try {
      const updated = await items.clearConfirmed(pool, Number(req.params.id));
      if (!updated) return res.status(404).json({ error: 'Item not found' });
      res.json(updated);
    } catch (e) { next(e); }
  });

  return r;
}
