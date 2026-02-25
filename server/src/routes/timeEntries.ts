import { Router } from 'express';
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { clients, projects, settings, tags, timeEntries, timeEntryTags } from '../db/schema';
import { createError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────

function roundDuration(secs: number, roundingMins: number, direction: string): number {
  if (roundingMins === 0) return secs;
  const roundingSecs = roundingMins * 60;
  if (direction === 'up')   return Math.ceil(secs  / roundingSecs) * roundingSecs;
  if (direction === 'down') return Math.floor(secs / roundingSecs) * roundingSecs;
  return Math.round(secs / roundingSecs) * roundingSecs;
}

async function getEntryWithTags(id: number) {
  const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
  if (!entry) return null;
  const entryTags = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(timeEntryTags)
    .innerJoin(tags, eq(timeEntryTags.tagId, tags.id))
    .where(eq(timeEntryTags.timeEntryId, id));
  return { ...entry, tags: entryTags };
}

async function getSettings() {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s;
}

// ─── GET /time-entries/running ─────────────────────────────────────────────
router.get('/running', async (_req, res, next) => {
  try {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.isRunning, true));
    if (!entry) { res.json({ data: null }); return; }
    res.json({ data: await getEntryWithTags(entry.id) });
  } catch (err) { next(err); }
});

// ─── GET /time-entries/export/csv ─────────────────────────────────────────
router.get('/export/csv', async (req, res, next) => {
  try {
    const { from, to, projectId, clientId } = req.query;

    let query = db.select({
      id:           timeEntries.id,
      description:  timeEntries.description,
      startedAt:    timeEntries.startedAt,
      endedAt:      timeEntries.endedAt,
      durationSecs: timeEntries.durationSecs,
      isBillable:   timeEntries.isBillable,
      hourlyRate:   timeEntries.hourlyRate,
      projectName:  projects.name,
      clientName:   clients.name,
    })
    .from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .leftJoin(clients,  eq(timeEntries.clientId,  clients.id))
    .$dynamic();

    if (from)      query = query.where(gte(timeEntries.startedAt, parseInt(from as string, 10)));
    if (to)        query = query.where(lte(timeEntries.startedAt, parseInt(to   as string, 10)));
    if (projectId) query = query.where(eq(timeEntries.projectId,  parseInt(projectId as string, 10)));
    if (clientId)  query = query.where(eq(timeEntries.clientId,   parseInt(clientId  as string, 10)));

    const rows = await query.orderBy(desc(timeEntries.startedAt));

    const header = 'Date,Start,End,Duration (h),Description,Project,Client,Billable,Rate\n';
    const body = rows.map(r => {
      const start = r.startedAt ? new Date(r.startedAt).toISOString() : '';
      const end   = r.endedAt   ? new Date(r.endedAt).toISOString()   : '';
      const date  = start.split('T')[0];
      const hours = r.durationSecs ? (r.durationSecs / 3600).toFixed(2) : '';
      const desc  = `"${(r.description ?? '').replace(/"/g, '""')}"`;
      return `${date},${start},${end},${hours},${desc},${r.projectName ?? ''},${r.clientName ?? ''},${r.isBillable ? 'Yes' : 'No'},${r.hourlyRate ?? ''}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="time-entries-${Date.now()}.csv"`);
    res.send(header + body);
  } catch (err) { next(err); }
});

// ─── GET /time-entries/unbilled-entries ───────────────────────────────────
router.get('/unbilled-entries', async (req, res, next) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;

    let query = db.select({
      id:           timeEntries.id,
      description:  timeEntries.description,
      startedAt:    timeEntries.startedAt,
      endedAt:      timeEntries.endedAt,
      durationSecs: timeEntries.durationSecs,
      hourlyRate:   timeEntries.hourlyRate,
      isBillable:   timeEntries.isBillable,
      projectId:    timeEntries.projectId,
      clientId:     timeEntries.clientId,
      projectName:  projects.name,
      clientName:   clients.name,
      projectRate:  projects.hourlyRate,
      clientRate:   clients.defaultRate,
    })
    .from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .leftJoin(clients,  eq(timeEntries.clientId,  clients.id))
    .where(and(
      isNull(timeEntries.invoiceId),
      eq(timeEntries.isBillable, true),
      isNotNull(timeEntries.endedAt),
    ))
    .$dynamic();

    if (clientId) query = query.where(eq(timeEntries.clientId, clientId));

    res.json({ data: await query.orderBy(desc(timeEntries.startedAt)) });
  } catch (err) { next(err); }
});

// ─── GET /time-entries ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { from, to, projectId, clientId, billable, invoiced, limit = '100', offset = '0' } = req.query;

    let query = db.select({
      id:                  timeEntries.id,
      description:         timeEntries.description,
      startedAt:           timeEntries.startedAt,
      endedAt:             timeEntries.endedAt,
      durationSecs:        timeEntries.durationSecs,
      roundedDurationSecs: timeEntries.roundedDurationSecs,
      isBillable:          timeEntries.isBillable,
      hourlyRate:          timeEntries.hourlyRate,
      isRunning:           timeEntries.isRunning,
      invoiceId:           timeEntries.invoiceId,
      projectId:           timeEntries.projectId,
      clientId:            timeEntries.clientId,
      createdAt:           timeEntries.createdAt,
      updatedAt:           timeEntries.updatedAt,
      projectName:         projects.name,
      projectColor:        projects.color,
      clientName:          clients.name,
    })
    .from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .leftJoin(clients,  eq(timeEntries.clientId,  clients.id))
    .$dynamic();

    if (from)      query = query.where(gte(timeEntries.startedAt, parseInt(from as string, 10)));
    if (to)        query = query.where(lte(timeEntries.startedAt, parseInt(to   as string, 10)));
    if (projectId) query = query.where(eq(timeEntries.projectId,  parseInt(projectId as string, 10)));
    if (clientId)  query = query.where(eq(timeEntries.clientId,   parseInt(clientId  as string, 10)));
    if (billable === 'true')  query = query.where(eq(timeEntries.isBillable, true));
    if (billable === 'false') query = query.where(eq(timeEntries.isBillable, false));
    if (invoiced === 'true')  query = query.where(isNotNull(timeEntries.invoiceId));
    if (invoiced === 'false') query = query.where(isNull(timeEntries.invoiceId));

    const rows = await query
      .orderBy(desc(timeEntries.startedAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    // Attach tags per row
    const enriched = await Promise.all(rows.map(async row => {
      const rowTags = await db
        .select({ id: tags.id, name: tags.name, color: tags.color })
        .from(timeEntryTags)
        .innerJoin(tags, eq(timeEntryTags.tagId, tags.id))
        .where(eq(timeEntryTags.timeEntryId, row.id));
      return { ...row, tags: rowTags };
    }));

    res.json({ data: enriched });
  } catch (err) { next(err); }
});

// ─── GET /time-entries/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getEntryWithTags(id);
    if (!entry) throw createError('Time entry not found', 404, 'NOT_FOUND');
    res.json({ data: entry });
  } catch (err) { next(err); }
});

// ─── POST /time-entries (manual entry) ───────────────────────────────────
const manualEntrySchema = z.object({
  projectId:   z.number().int().positive().optional().nullable(),
  clientId:    z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  startedAt:   z.number().int(),
  endedAt:     z.number().int().optional().nullable(),
  isBillable:  z.boolean().default(true),
  hourlyRate:  z.number().positive().optional().nullable(),
  tagIds:      z.array(z.number().int()).optional(),
});

router.post('/', validateBody(manualEntrySchema), async (req, res, next) => {
  try {
    const { tagIds, ...entryData } = req.body;
    const now = Date.now();

    let durationSecs: number | undefined;
    let roundedDurationSecs: number | undefined;

    if (entryData.startedAt && entryData.endedAt) {
      durationSecs = Math.round((entryData.endedAt - entryData.startedAt) / 1000);
      const s = await getSettings();
      if (s?.timeRoundingMins > 0) {
        roundedDurationSecs = roundDuration(durationSecs, s.timeRoundingMins, s.roundingDirection);
      }
    }

    const [result] = await db
      .insert(timeEntries)
      .values({ ...entryData, durationSecs, roundedDurationSecs, isRunning: false, createdAt: now, updatedAt: now })
      .returning();

    if (tagIds?.length) {
      await db.insert(timeEntryTags).values(tagIds.map((tid: number) => ({ timeEntryId: result.id, tagId: tid })));
    }

    res.status(201).json({ data: await getEntryWithTags(result.id) });
  } catch (err) { next(err); }
});

// ─── POST /time-entries/start ─────────────────────────────────────────────
const startTimerSchema = z.object({
  projectId:   z.number().int().positive().optional().nullable(),
  clientId:    z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  isBillable:  z.boolean().default(true),
  hourlyRate:  z.number().positive().optional().nullable(),
  tagIds:      z.array(z.number().int()).optional(),
});

router.post('/start', validateBody(startTimerSchema), async (req, res, next) => {
  try {
    // Stop any currently running timer first
    const [running] = await db.select().from(timeEntries).where(eq(timeEntries.isRunning, true));
    if (running) {
      const now2 = Date.now();
      const durationSecs = Math.round((now2 - running.startedAt) / 1000);
      await db.update(timeEntries)
        .set({ isRunning: false, endedAt: now2, durationSecs, updatedAt: now2 })
        .where(eq(timeEntries.id, running.id));
    }

    const { tagIds, ...entryData } = req.body;
    const now = Date.now();
    const [result] = await db
      .insert(timeEntries)
      .values({ ...entryData, startedAt: now, isRunning: true, createdAt: now, updatedAt: now })
      .returning();

    if (tagIds?.length) {
      await db.insert(timeEntryTags).values(tagIds.map((tid: number) => ({ timeEntryId: result.id, tagId: tid })));
    }

    res.status(201).json({ data: await getEntryWithTags(result.id) });
  } catch (err) { next(err); }
});

// ─── POST /time-entries/:id/stop ──────────────────────────────────────────
router.post('/:id/stop', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!entry) throw createError('Time entry not found', 404, 'NOT_FOUND');
    if (!entry.isRunning) throw createError('Timer is not running', 400, 'NOT_RUNNING');

    const now = Date.now();
    const rawDuration = Math.round((now - entry.startedAt) / 1000);
    const s = await getSettings();
    const rounded = s?.timeRoundingMins > 0
      ? roundDuration(rawDuration, s.timeRoundingMins, s.roundingDirection)
      : undefined;

    const [result] = await db
      .update(timeEntries)
      .set({ isRunning: false, endedAt: now, durationSecs: rawDuration, roundedDurationSecs: rounded ?? null, updatedAt: now })
      .where(eq(timeEntries.id, id))
      .returning();

    res.json({ data: await getEntryWithTags(result.id) });
  } catch (err) { next(err); }
});

// ─── POST /time-entries/:id/pause ─────────────────────────────────────────
router.post('/:id/pause', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!entry) throw createError('Time entry not found', 404, 'NOT_FOUND');
    if (!entry.isRunning) throw createError('Timer is not running', 400, 'NOT_RUNNING');

    const now = Date.now();
    const elapsed = Math.round((now - entry.startedAt) / 1000);
    const [result] = await db
      .update(timeEntries)
      .set({ isRunning: false, durationSecs: elapsed, updatedAt: now })
      .where(eq(timeEntries.id, id))
      .returning();

    res.json({ data: await getEntryWithTags(result.id) });
  } catch (err) { next(err); }
});

// ─── POST /time-entries/:id/resume ────────────────────────────────────────
router.post('/:id/resume', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!entry) throw createError('Time entry not found', 404, 'NOT_FOUND');
    if (entry.isRunning)  throw createError('Timer is already running',  400, 'ALREADY_RUNNING');
    if (entry.endedAt)    throw createError('Entry is already completed', 400, 'ALREADY_COMPLETED');

    // Stop any other running timer
    const [running] = await db.select().from(timeEntries).where(eq(timeEntries.isRunning, true));
    if (running) {
      const now2 = Date.now();
      const d = Math.round((now2 - running.startedAt) / 1000);
      await db.update(timeEntries).set({ isRunning: false, endedAt: now2, durationSecs: d, updatedAt: now2 }).where(eq(timeEntries.id, running.id));
    }

    // Adjust startedAt so elapsed already accounts for previously paused secs
    const previousSecs = entry.durationSecs ?? 0;
    const newStartedAt = Date.now() - previousSecs * 1000;

    const [result] = await db
      .update(timeEntries)
      .set({ isRunning: true, startedAt: newStartedAt, durationSecs: null, updatedAt: Date.now() })
      .where(eq(timeEntries.id, id))
      .returning();

    res.json({ data: await getEntryWithTags(result.id) });
  } catch (err) { next(err); }
});

// ─── PUT /time-entries/:id ────────────────────────────────────────────────
const updateEntrySchema = z.object({
  projectId:   z.number().int().positive().optional().nullable(),
  clientId:    z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  startedAt:   z.number().int().optional(),
  endedAt:     z.number().int().optional().nullable(),
  isBillable:  z.boolean().optional(),
  hourlyRate:  z.number().positive().optional().nullable(),
  tagIds:      z.array(z.number().int()).optional(),
});

router.put('/:id', validateBody(updateEntrySchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!entry) throw createError('Time entry not found', 404, 'NOT_FOUND');

    const { tagIds, ...updateData } = req.body;

    // Recompute duration if times changed
    const newStart = updateData.startedAt ?? entry.startedAt;
    const newEnd   = updateData.endedAt !== undefined ? updateData.endedAt : entry.endedAt;
    if (newStart && newEnd) {
      updateData.durationSecs = Math.round((newEnd - newStart) / 1000);
    }

    const [result] = await db
      .update(timeEntries)
      .set({ ...updateData, updatedAt: Date.now() })
      .where(eq(timeEntries.id, id))
      .returning();

    if (tagIds !== undefined) {
      await db.delete(timeEntryTags).where(eq(timeEntryTags.timeEntryId, id));
      if (tagIds.length) {
        await db.insert(timeEntryTags).values(tagIds.map((tid: number) => ({ timeEntryId: id, tagId: tid })));
      }
    }

    res.json({ data: await getEntryWithTags(result.id) });
  } catch (err) { next(err); }
});

// ─── DELETE /time-entries/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!entry) throw createError('Time entry not found', 404, 'NOT_FOUND');
    if (entry.invoiceId) throw createError('Cannot delete an invoiced time entry', 400, 'INVOICED');
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
