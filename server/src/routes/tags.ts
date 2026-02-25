import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { tags } from '../db/schema';
import { createError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const tagSchema = z.object({
  name:  z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#94a3b8'),
});

router.get('/', async (_req, res, next) => {
  try {
    const rows = await db.select().from(tags).orderBy(tags.name);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.post('/', validateBody(tagSchema), async (req, res, next) => {
  try {
    const [result] = await db.insert(tags).values(req.body).returning();
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

router.put('/:id', validateBody(tagSchema.partial()), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(tags).where(eq(tags.id, id));
    if (!existing) throw createError('Tag not found', 404, 'NOT_FOUND');
    const [result] = await db.update(tags).set(req.body).where(eq(tags.id, id)).returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(tags).where(eq(tags.id, id));
    if (!existing) throw createError('Tag not found', 404, 'NOT_FOUND');
    await db.delete(tags).where(eq(tags.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
