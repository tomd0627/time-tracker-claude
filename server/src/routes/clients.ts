import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { clients, projects, timeEntries } from '../db/schema';
import { createError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const clientSchema = z.object({
  name:        z.string().min(1),
  email:       z.string().email().optional().nullable(),
  phone:       z.string().optional().nullable(),
  address:     z.string().optional().nullable(),
  city:        z.string().optional().nullable(),
  country:     z.string().optional().nullable(),
  currency:    z.string().length(3).default('USD'),
  defaultRate: z.number().positive().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

// GET /api/clients
router.get('/', async (req, res, next) => {
  try {
    const showArchived = req.query.archived === 'true';
    const rows = await db
      .select()
      .from(clients)
      .where(showArchived ? undefined : eq(clients.isArchived, false))
      .orderBy(clients.name);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) throw createError('Client not found', 404, 'NOT_FOUND');

    const clientProjects = await db.select().from(projects).where(eq(projects.clientId, id));
    const [stats] = await db
      .select({
        totalSecs:  sql<number>`COALESCE(SUM(duration_secs), 0)`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(timeEntries)
      .where(eq(timeEntries.clientId, id));

    res.json({ data: { ...client, projects: clientProjects, stats } });
  } catch (err) { next(err); }
});

// POST /api/clients
router.post('/', validateBody(clientSchema), async (req, res, next) => {
  try {
    const now = Date.now();
    const [result] = await db.insert(clients).values({ ...req.body, createdAt: now, updatedAt: now }).returning();
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/clients/:id
router.put('/:id', validateBody(clientSchema.partial()), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(clients).where(eq(clients.id, id));
    if (!existing) throw createError('Client not found', 404, 'NOT_FOUND');

    const [result] = await db
      .update(clients)
      .set({ ...req.body, updatedAt: Date.now() })
      .where(eq(clients.id, id))
      .returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

// DELETE /api/clients/:id  (soft delete — archive)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(clients).where(eq(clients.id, id));
    if (!existing) throw createError('Client not found', 404, 'NOT_FOUND');

    await db.update(clients).set({ isArchived: true, updatedAt: Date.now() }).where(eq(clients.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
