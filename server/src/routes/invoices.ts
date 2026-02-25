import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/connection';
import { clients, invoiceLineItems, invoices, timeEntries } from '../db/schema';
import { createError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';
import { computeTotals, createInvoice, getInvoiceWithItems } from '../services/invoiceService';
import { generateInvoicePdf } from '../services/pdfService';

const router = Router();

const lineItemSchema = z.object({
  timeEntryId: z.number().int().positive().optional().nullable(),
  expenseId:   z.number().int().positive().optional().nullable(),
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unitPrice:   z.number().min(0),
  sortOrder:   z.number().int().optional(),
});

const createInvoiceSchema = z.object({
  clientId:       z.number().int().positive(),
  currency:       z.string().length(3).default('USD'),
  issueDate:      z.number().int(),
  dueDate:        z.number().int().optional().nullable(),
  taxRate:        z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  notes:          z.string().optional().nullable(),
  lineItems:      z.array(lineItemSchema).min(1),
});

const updateInvoiceSchema = z.object({
  currency:       z.string().length(3).optional(),
  issueDate:      z.number().int().optional(),
  dueDate:        z.number().int().optional().nullable(),
  taxRate:        z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  notes:          z.string().optional().nullable(),
  lineItems:      z.array(lineItemSchema).optional(),
});

// GET /api/invoices
router.get('/', async (req, res, next) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
    const status   = req.query.status as string | undefined;

    let query = db.select({
      id:            invoices.id,
      clientId:      invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      status:        invoices.status,
      issueDate:     invoices.issueDate,
      dueDate:       invoices.dueDate,
      currency:      invoices.currency,
      subtotal:      invoices.subtotal,
      total:         invoices.total,
      taxRate:       invoices.taxRate,
      paidAt:        invoices.paidAt,
      sentAt:        invoices.sentAt,
      createdAt:     invoices.createdAt,
      clientName:    clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .$dynamic();

    if (clientId) query = query.where(eq(invoices.clientId, clientId));
    if (status)   query = query.where(eq(invoices.status, status));

    const rows = await query.orderBy(invoices.createdAt);
    res.json({ data: rows.reverse() });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await getInvoiceWithItems(id);
    if (!invoice) throw createError('Invoice not found', 404, 'NOT_FOUND');
    const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
    res.json({ data: { ...invoice, client } });
  } catch (err) { next(err); }
});

// POST /api/invoices
router.post('/', validateBody(createInvoiceSchema), async (req, res, next) => {
  try {
    const invoice = await createInvoice(req.body);
    res.status(201).json({ data: invoice });
  } catch (err) { next(err); }
});

// PUT /api/invoices/:id
router.put('/:id', validateBody(updateInvoiceSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) throw createError('Invoice not found', 404, 'NOT_FOUND');
    if (existing.status !== 'draft') throw createError('Only draft invoices can be edited', 400, 'NOT_DRAFT');

    const { lineItems, ...headerData } = req.body;
    const now = Date.now();

    if (lineItems !== undefined) {
      // Unlock previously linked time entries
      const oldItems = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
      for (const item of oldItems) {
        if (item.timeEntryId) {
          await db.update(timeEntries).set({ invoiceId: null, updatedAt: now }).where(eq(timeEntries.id, item.timeEntryId));
        }
      }
      await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));

      if (lineItems.length > 0) {
        await db.insert(invoiceLineItems).values(
          lineItems.map((li: z.infer<typeof lineItemSchema>, i: number) => ({
            invoiceId:   id,
            timeEntryId: li.timeEntryId ?? null,
            expenseId:   li.expenseId   ?? null,
            description: li.description,
            quantity:    li.quantity,
            unitPrice:   li.unitPrice,
            amount:      Math.round(li.quantity * li.unitPrice * 100) / 100,
            sortOrder:   li.sortOrder ?? i,
          }))
        );
        for (const li of lineItems) {
          if (li.timeEntryId) {
            await db.update(timeEntries).set({ invoiceId: id, updatedAt: now }).where(eq(timeEntries.id, li.timeEntryId));
          }
        }
      }
    }

    // Recompute totals
    const allItems  = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
    const taxRate        = headerData.taxRate        ?? existing.taxRate;
    const discountAmount = headerData.discountAmount ?? existing.discountAmount;
    const { subtotal, taxAmount, total } = computeTotals(allItems, taxRate, discountAmount);

    await db.update(invoices)
      .set({ ...headerData, subtotal, taxAmount, total, updatedAt: now })
      .where(eq(invoices.id, id));

    res.json({ data: await getInvoiceWithItems(id) });
  } catch (err) { next(err); }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) throw createError('Invoice not found', 404, 'NOT_FOUND');
    if (existing.status !== 'draft') throw createError('Only draft invoices can be deleted', 400, 'NOT_DRAFT');

    const now = Date.now();
    const items = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
    for (const item of items) {
      if (item.timeEntryId) {
        await db.update(timeEntries).set({ invoiceId: null, updatedAt: now }).where(eq(timeEntries.id, item.timeEntryId));
      }
    }
    await db.delete(invoices).where(eq(invoices.id, id));
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/invoices/:id/send
router.post('/:id/send', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) throw createError('Invoice not found', 404, 'NOT_FOUND');
    const now = Date.now();
    const [result] = await db.update(invoices)
      .set({ status: 'sent', sentAt: now, updatedAt: now })
      .where(eq(invoices.id, id))
      .returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

// POST /api/invoices/:id/mark-paid
router.post('/:id/mark-paid', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) throw createError('Invoice not found', 404, 'NOT_FOUND');
    const now = Date.now();
    const [result] = await db.update(invoices)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(eq(invoices.id, id))
      .returning();
    res.json({ data: result });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) throw createError('Invoice not found', 404, 'NOT_FOUND');
    const pdfBuffer = await generateInvoicePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${existing.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

export default router;
