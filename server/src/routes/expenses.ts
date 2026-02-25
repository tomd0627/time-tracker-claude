import { Router } from 'express';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { expenses } from '../db/schema';
import { createError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const expenseSchema = z.object({
  projectId:   z.number().int().positive().optional().nullable(),
  clientId:    z.number().int().positive().optional().nullable(),
  description: z.string().min(1),
  amount:      z.number().positive(),
  currency:    z.string().length(3).default('USD'),
  date:        z.number().int(),
  isBillable:  z.boolean().default(true),
  receiptPath: z.string().optional().nullable(),
});

router.get('/', async (req, res, next) => {
  try {
    const projectId  = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
    const clientId   = req.query.clientId  ? parseInt(req.query.clientId  as string, 10) : undefined;
    const uninvoiced = req.query.invoiced === 'false';

    let query = db.select().from(expenses).$dynamic();
    if (projectId)  query = query.where(eq(expenses.projectId, projectId));
    if (clientId)   query = query.where(eq(expenses.clientId, clientId));
    if (uninvoiced) query = query.where(isNull(expenses.invoiceId));

    res.json({ data: await query });
  } catch (err) { next(err); }
});

router.post('/', validateBody(expenseSchema), async (req, res, next) => {
  try {
    const now = Date.now();
    const [result] = await db.insert(expenses).values({ ...req.body, createdAt: now, updatedAt: now }).returning();
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

router.put('/:id', validateBody(expenseSchema.partial()), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!existing) throw createError('Expense not found', 404, 'NOT_FOUND');
    const [result] = await db.update(expenses).set({ ...req.body, updatedAt: Date.now() }).where(eq(expenses.id, id)).returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!existing) throw createError('Expense not found', 404, 'NOT_FOUND');
    await db.delete(expenses).where(eq(expenses.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
