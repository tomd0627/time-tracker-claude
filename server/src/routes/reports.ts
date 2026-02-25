import { Router } from 'express';
import { eq, gte, lte, sql, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { clients, projects, timeEntries } from '../db/schema';

const router = Router();

function parseDateRange(req: any) {
  const now = Date.now();
  const from = req.query.from ? parseInt(req.query.from, 10) : now - 30 * 24 * 60 * 60 * 1000;
  const to   = req.query.to   ? parseInt(req.query.to,   10) : now;
  return { from, to };
}

// GET /api/reports/summary
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const [result] = await db
      .select({
        totalSecs:    sql<number>`COALESCE(SUM(duration_secs), 0)`,
        billableSecs: sql<number>`COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_secs ELSE 0 END), 0)`,
        entryCount:   sql<number>`COUNT(*)`,
        revenue:      sql<number>`COALESCE(SUM(CASE WHEN is_billable = 1 THEN (duration_secs / 3600.0) * COALESCE(hourly_rate, 0) ELSE 0 END), 0)`,
      })
      .from(timeEntries)
      .where(and(
        gte(timeEntries.startedAt, from),
        lte(timeEntries.startedAt, to),
        sql`ended_at IS NOT NULL`,
      ));
    res.json({ data: result });
  } catch (err) { next(err); }
});

// GET /api/reports/by-client
router.get('/by-client', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const rows = await db
      .select({
        clientId:     timeEntries.clientId,
        clientName:   clients.name,
        totalSecs:    sql<number>`COALESCE(SUM(${timeEntries.durationSecs}), 0)`,
        billableSecs: sql<number>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = 1 THEN ${timeEntries.durationSecs} ELSE 0 END), 0)`,
        revenue:      sql<number>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = 1 THEN (${timeEntries.durationSecs} / 3600.0) * COALESCE(${timeEntries.hourlyRate}, 0) ELSE 0 END), 0)`,
        entryCount:   sql<number>`COUNT(*)`,
      })
      .from(timeEntries)
      .leftJoin(clients, eq(timeEntries.clientId, clients.id))
      .where(and(
        gte(timeEntries.startedAt, from),
        lte(timeEntries.startedAt, to),
        sql`${timeEntries.endedAt} IS NOT NULL`,
      ))
      .groupBy(timeEntries.clientId);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/by-project
router.get('/by-project', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const rows = await db
      .select({
        projectId:    timeEntries.projectId,
        projectName:  projects.name,
        projectColor: projects.color,
        clientId:     timeEntries.clientId,
        clientName:   clients.name,
        totalSecs:    sql<number>`COALESCE(SUM(${timeEntries.durationSecs}), 0)`,
        billableSecs: sql<number>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = 1 THEN ${timeEntries.durationSecs} ELSE 0 END), 0)`,
        revenue:      sql<number>`COALESCE(SUM(CASE WHEN ${timeEntries.isBillable} = 1 THEN (${timeEntries.durationSecs} / 3600.0) * COALESCE(${timeEntries.hourlyRate}, 0) ELSE 0 END), 0)`,
        entryCount:   sql<number>`COUNT(*)`,
      })
      .from(timeEntries)
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(clients,  eq(timeEntries.clientId,  clients.id))
      .where(and(
        gte(timeEntries.startedAt, from),
        lte(timeEntries.startedAt, to),
        sql`${timeEntries.endedAt} IS NOT NULL`,
      ))
      .groupBy(timeEntries.projectId);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/by-week
router.get('/by-week', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const rows = await db
      .select({
        week:         sql<string>`strftime('%Y-%W', started_at / 1000, 'unixepoch')`,
        totalSecs:    sql<number>`COALESCE(SUM(duration_secs), 0)`,
        billableSecs: sql<number>`COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_secs ELSE 0 END), 0)`,
        entryCount:   sql<number>`COUNT(*)`,
      })
      .from(timeEntries)
      .where(and(
        gte(timeEntries.startedAt, from),
        lte(timeEntries.startedAt, to),
        sql`ended_at IS NOT NULL`,
      ))
      .groupBy(sql`strftime('%Y-%W', started_at / 1000, 'unixepoch')`)
      .orderBy(sql`strftime('%Y-%W', started_at / 1000, 'unixepoch')`);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/by-month
router.get('/by-month', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const rows = await db
      .select({
        month:        sql<string>`strftime('%Y-%m', started_at / 1000, 'unixepoch')`,
        totalSecs:    sql<number>`COALESCE(SUM(duration_secs), 0)`,
        billableSecs: sql<number>`COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_secs ELSE 0 END), 0)`,
        revenue:      sql<number>`COALESCE(SUM(CASE WHEN is_billable = 1 THEN (duration_secs / 3600.0) * COALESCE(hourly_rate, 0) ELSE 0 END), 0)`,
        entryCount:   sql<number>`COUNT(*)`,
      })
      .from(timeEntries)
      .where(and(
        gte(timeEntries.startedAt, from),
        lte(timeEntries.startedAt, to),
        sql`ended_at IS NOT NULL`,
      ))
      .groupBy(sql`strftime('%Y-%m', started_at / 1000, 'unixepoch')`)
      .orderBy(sql`strftime('%Y-%m', started_at / 1000, 'unixepoch')`);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

export default router;
