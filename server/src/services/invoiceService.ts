import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { expenses, invoiceLineItems, invoices, settings, timeEntries } from '../db/schema';

export interface LineItemInput {
  timeEntryId?:  number | null;
  expenseId?:    number | null;
  description:   string;
  quantity:      number;
  unitPrice:     number;
  sortOrder?:    number;
}

export interface CreateInvoiceInput {
  clientId:        number;
  currency:        string;
  issueDate:       number;
  dueDate?:        number | null;
  taxRate?:        number;
  discountAmount?: number;
  notes?:          string | null;
  lineItems:       LineItemInput[];
}

export async function generateInvoiceNumber(): Promise<string> {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  const prefix = s?.invoicePrefix ?? 'INV';
  const num    = s?.invoiceNextNumber ?? 1;
  const padded = String(num).padStart(4, '0');
  await db.update(settings).set({ invoiceNextNumber: num + 1 }).where(eq(settings.id, 1));
  return `${prefix}-${padded}`;
}

export function computeTotals(
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  discountAmount: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal   = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const discounted = Math.max(0, subtotal - discountAmount);
  const taxAmount  = discounted * (taxRate / 100);
  return {
    subtotal:  Math.round(subtotal  * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total:     Math.round((discounted + taxAmount) * 100) / 100,
  };
}

export async function createInvoice(input: CreateInvoiceInput) {
  const taxRate        = input.taxRate        ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const { subtotal, taxAmount, total } = computeTotals(input.lineItems, taxRate, discountAmount);
  const invoiceNumber  = await generateInvoiceNumber();
  const now = Date.now();

  const [invoice] = await db.insert(invoices).values({
    clientId:       input.clientId,
    invoiceNumber,
    status:         'draft',
    issueDate:      input.issueDate,
    dueDate:        input.dueDate ?? null,
    currency:       input.currency,
    subtotal, taxRate, taxAmount, discountAmount, total,
    notes:          input.notes ?? null,
    createdAt:      now,
    updatedAt:      now,
  }).returning();

  if (input.lineItems.length > 0) {
    await db.insert(invoiceLineItems).values(
      input.lineItems.map((li, i) => ({
        invoiceId:   invoice.id,
        timeEntryId: li.timeEntryId ?? null,
        expenseId:   li.expenseId   ?? null,
        description: li.description,
        quantity:    li.quantity,
        unitPrice:   li.unitPrice,
        amount:      Math.round(li.quantity * li.unitPrice * 100) / 100,
        sortOrder:   li.sortOrder ?? i,
      }))
    );

    // Lock time entries against double-billing
    for (const li of input.lineItems) {
      if (li.timeEntryId) {
        await db.update(timeEntries).set({ invoiceId: invoice.id, updatedAt: now }).where(eq(timeEntries.id, li.timeEntryId));
      }
      if (li.expenseId) {
        await db.update(expenses).set({ invoiceId: invoice.id, updatedAt: now }).where(eq(expenses.id, li.expenseId));
      }
    }
  }

  return getInvoiceWithItems(invoice.id);
}

export async function getInvoiceWithItems(id: number) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!invoice) return null;
  const items = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
  return { ...invoice, lineItems: items };
}
