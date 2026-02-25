import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import { db } from '../db/connection';
import { clients, invoiceLineItems, invoices, settings } from '../db/schema';

const ACCENT = rgb(0.388, 0.4, 0.945);
const DARK   = rgb(0.1, 0.1, 0.1);
const GRAY   = rgb(0.45, 0.45, 0.45);
const LIGHT  = rgb(0.96, 0.96, 0.98);
const WHITE  = rgb(1, 1, 1);

interface TextOptions {
  x: number; y: number; size?: number;
  color?: ReturnType<typeof rgb>;
  font?: PDFFont;
}

function drawText(page: PDFPage, text: string, opts: TextOptions) {
  page.drawText(String(text), {
    x: opts.x, y: opts.y,
    size:  opts.size  ?? 10,
    color: opts.color ?? DARK,
    font:  opts.font,
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function generateInvoicePdf(invoiceId: number): Promise<Buffer> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const [client] = invoice.clientId
    ? await db.select().from(clients).where(eq(clients.id, invoice.clientId))
    : [undefined];
  const lineItems = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));

  const pdfDoc  = await PDFDocument.create();
  const page    = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const margin  = 50;
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = height - margin;

  // Header bar
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: ACCENT });
  drawText(page, 'INVOICE',            { x: margin,             y: height - 55, size: 28, color: WHITE, font: bold });
  drawText(page, invoice.invoiceNumber, { x: width - margin - 120, y: height - 45, size: 14, color: WHITE, font: bold });

  y = height - 100;

  // Biller info (left)
  const billerName = s?.myName ?? 'Your Name';
  drawText(page, billerName, { x: margin, y, size: 12, font: bold }); y -= 16;
  if (s?.myEmail)   { drawText(page, s.myEmail,   { x: margin, y, size: 9, color: GRAY, font: regular }); y -= 13; }
  if (s?.myPhone)   { drawText(page, s.myPhone,   { x: margin, y, size: 9, color: GRAY, font: regular }); y -= 13; }
  if (s?.myAddress) {
    for (const line of s.myAddress.split('\n')) {
      drawText(page, line, { x: margin, y, size: 9, color: GRAY, font: regular }); y -= 13;
    }
  }

  // Bill To (right)
  let billY = height - 100;
  const rightX = width / 2;
  drawText(page, 'BILL TO', { x: rightX, y: billY, size: 8, color: GRAY, font: bold }); billY -= 14;
  if (client) {
    drawText(page, client.name, { x: rightX, y: billY, size: 11, font: bold }); billY -= 14;
    if (client.email)   { drawText(page, client.email,   { x: rightX, y: billY, size: 9, color: GRAY, font: regular }); billY -= 12; }
    if (client.phone)   { drawText(page, client.phone,   { x: rightX, y: billY, size: 9, color: GRAY, font: regular }); billY -= 12; }
    if (client.address) { drawText(page, client.address, { x: rightX, y: billY, size: 9, color: GRAY, font: regular }); billY -= 12; }
    if (client.city)    {
      drawText(page, `${client.city}${client.country ? `, ${client.country}` : ''}`, { x: rightX, y: billY, size: 9, color: GRAY, font: regular });
    }
  }

  // Dates
  y = Math.min(y, billY) - 30;
  const dateX = width - margin - 200;
  drawText(page, 'Issue Date:', { x: dateX, y, size: 9, color: GRAY, font: regular });
  drawText(page, formatDate(invoice.issueDate), { x: dateX + 80, y, size: 9, font: bold });
  if (invoice.dueDate) {
    y -= 14;
    drawText(page, 'Due Date:', { x: dateX, y, size: 9, color: GRAY, font: regular });
    drawText(page, formatDate(invoice.dueDate), { x: dateX + 80, y, size: 9, font: bold });
  }
  y -= 14;
  drawText(page, 'Status:', { x: dateX, y, size: 9, color: GRAY, font: regular });
  drawText(page, invoice.status.toUpperCase(), { x: dateX + 80, y, size: 9, font: bold, color: ACCENT });

  // Line items table
  y -= 30;
  const colDesc = margin;
  const colQty  = width - margin - 200;
  const colRate = width - margin - 120;
  const colAmt  = width - margin - 40;
  const rowH    = 22;

  // Header row
  page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: rowH, color: ACCENT });
  drawText(page, 'Description', { x: colDesc + 4, y: y + 4, size: 9, color: WHITE, font: bold });
  drawText(page, 'Qty / Hrs',   { x: colQty,       y: y + 4, size: 9, color: WHITE, font: bold });
  drawText(page, 'Rate',        { x: colRate,       y: y + 4, size: 9, color: WHITE, font: bold });
  drawText(page, 'Amount',      { x: colAmt - 30,   y: y + 4, size: 9, color: WHITE, font: bold });
  y -= rowH;

  lineItems.forEach((item, i) => {
    const bg = i % 2 === 0 ? LIGHT : WHITE;
    page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: rowH, color: bg });
    const desc = item.description.length > 55 ? item.description.slice(0, 52) + '...' : item.description;
    drawText(page, desc,                                                     { x: colDesc + 4, y: y + 4, size: 9, font: regular });
    drawText(page, item.quantity.toFixed(2),                                 { x: colQty,      y: y + 4, size: 9, font: regular });
    drawText(page, formatCurrency(item.unitPrice, invoice.currency),         { x: colRate,     y: y + 4, size: 9, font: regular });
    drawText(page, formatCurrency(item.amount,    invoice.currency),         { x: colAmt - 40, y: y + 4, size: 9, font: bold   });
    y -= rowH;
  });

  // Totals
  y -= 10;
  const totX  = width - margin - 180;
  const totVX = width - margin - 40;

  const drawTotalRow = (label: string, value: string, highlight = false) => {
    if (highlight) page.drawRectangle({ x: totX - 4, y: y - 4, width: 184, height: 20, color: ACCENT });
    drawText(page, label, { x: totX,       y, size: 9, color: highlight ? WHITE : GRAY, font: highlight ? bold : regular });
    drawText(page, value, { x: totVX - 40, y, size: 9, color: highlight ? WHITE : DARK, font: highlight ? bold : regular });
    y -= 20;
  };

  drawTotalRow('Subtotal:', formatCurrency(invoice.subtotal, invoice.currency));
  if (invoice.discountAmount > 0) drawTotalRow('Discount:', `-${formatCurrency(invoice.discountAmount, invoice.currency)}`);
  if (invoice.taxRate > 0)        drawTotalRow(`Tax (${invoice.taxRate}%):`, formatCurrency(invoice.taxAmount, invoice.currency));
  drawTotalRow('TOTAL DUE:', formatCurrency(invoice.total, invoice.currency), true);

  // Footer
  const footerNote = invoice.notes ?? s?.invoiceFooterNotes;
  if (footerNote) {
    y -= 20;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: GRAY });
    y -= 14;
    for (const line of footerNote.split('\n')) {
      drawText(page, line, { x: margin, y, size: 9, color: GRAY, font: regular }); y -= 12;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

export async function saveInvoicePdf(invoiceId: number): Promise<string> {
  const pdfBytes = await generateInvoicePdf(invoiceId);
  const dir = path.join(process.cwd(), 'data', 'invoices');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `invoice-${invoiceId}-${Date.now()}.pdf`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, pdfBytes);
  return path.relative(process.cwd(), filepath);
}
