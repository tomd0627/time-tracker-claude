import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { clients, projects, timeEntries } from '../db/schema';
import { createError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const projectSchema = z.object({
  clientId:    z.number().int().positive().optional().nullable(),
  name:        z.string().min(1),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  status:      z.enum(['active', 'paused', 'completed', 'archived']).default('active'),
  hourlyRate:  z.number().positive().optional().nullable(),
  budgetHours: z.number().positive().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

// GET /api/projects
router.get('/', async (req, res, next) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
    const status   = req.query.status as string | undefined;

    let query = db.select().from(projects).$dynamic();
    if (clientId) query = query.where(eq(projects.clientId, clientId));

    const rows = await query.orderBy(projects.name);
    const filtered = status ? rows.filter(p => p.status === status) : rows;

    // Attach hours spent per project
    const enriched = await Promise.all(filtered.map(async p => {
      const [stats] = await db
        .select({ hoursSpent: sql<number>`COALESCE(SUM(duration_secs), 0) / 3600.0` })
        .from(timeEntries)
        .where(eq(timeEntries.projectId, p.id));
      return { ...p, hoursSpent: stats?.hoursSpent ?? 0 };
    }));

    res.json({ data: enriched });
  } catch (err) { next(err); }
});

// GET /api/projects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) throw createError('Project not found', 404, 'NOT_FOUND');

    const [client] = project.clientId
      ? await db.select().from(clients).where(eq(clients.id, project.clientId))
      : [null];

    const [stats] = await db
      .select({
        hoursSpent:    sql<number>`COALESCE(SUM(duration_secs), 0) / 3600.0`,
        billableHours: sql<number>`COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_secs ELSE 0 END), 0) / 3600.0`,
        entryCount:    sql<number>`COUNT(*)`,
      })
      .from(timeEntries)
      .where(eq(timeEntries.projectId, id));

    res.json({ data: { ...project, client, stats } });
  } catch (err) { next(err); }
});

// POST /api/projects
router.post('/', validateBody(projectSchema), async (req, res, next) => {
  try {
    const now = Date.now();
    const [result] = await db.insert(projects).values({ ...req.body, createdAt: now, updatedAt: now }).returning();
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/projects/:id
router.put('/:id', validateBody(projectSchema.partial()), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(projects).where(eq(projects.id, id));
    if (!existing) throw createError('Project not found', 404, 'NOT_FOUND');

    const [result] = await db
      .update(projects)
      .set({ ...req.body, updatedAt: Date.now() })
      .where(eq(projects.id, id))
      .returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(projects).where(eq(projects.id, id));
    if (!existing) throw createError('Project not found', 404, 'NOT_FOUND');

    await db.update(projects).set({ status: 'archived', updatedAt: Date.now() }).where(eq(projects.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
