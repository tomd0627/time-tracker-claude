import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { settings } from '../db/schema';
import { validateBody } from '../middleware/validate';

const router = Router();

const settingsSchema = z.object({
  invoicePrefix:       z.string().min(1).optional(),
  invoiceNextNumber:   z.number().int().positive().optional(),
  defaultCurrency:     z.string().length(3).optional(),
  defaultTaxRate:      z.number().min(0).max(100).optional(),
  timeRoundingMins:    z.union([z.literal(0), z.literal(6), z.literal(15), z.literal(30)]).optional(),
  roundingDirection:   z.enum(['up', 'down', 'nearest']).optional(),
  defaultPaymentTerms: z.number().int().positive().optional(),
  invoiceFooterNotes:  z.string().optional().nullable(),
  darkMode:            z.boolean().optional(),
  myName:              z.string().optional().nullable(),
  myEmail:             z.string().email().optional().nullable(),
  myAddress:           z.string().optional().nullable(),
  myPhone:             z.string().optional().nullable(),
});

router.get('/', async (_req, res, next) => {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));
    res.json({ data: row });
  } catch (err) { next(err); }
});

router.put('/', validateBody(settingsSchema), async (req, res, next) => {
  try {
    const [result] = await db
      .update(settings)
      .set(req.body)
      .where(eq(settings.id, 1))
      .returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
