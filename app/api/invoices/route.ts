import { InvoiceService, InvoiceServiceError } from '@/lib/services/InvoiceService';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { InvoiceRepository } from '@/lib/repositories/InvoiceRepository';
import { invoiceSchema } from '@/lib/validations';
import { computeTotals, getTaxRates } from '@/lib/api/invoice-logic';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';
import { getNextNumber } from '@/lib/api/numbering';
import { getSession } from '@/lib/api/auth';
import type {
  InvoiceResponse,
  InvoiceItem,
  PaymentResponse,
  ErrorResponse,
  DbInvoice,
  DbClient,
} from '@/lib/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' } as ErrorResponse, { status: 401 });
    }

    const invoices = InvoiceRepository.findAll(session.userId, session.role);

    const formattedInvoices: InvoiceResponse[] = invoices.map((i): InvoiceResponse => ({
      ...i,
      items: JSON.parse(i.items || '[]') as InvoiceItem[],
      payments: JSON.parse(i.payments || '[]') as PaymentResponse[],
    }));

    const response = NextResponse.json(formattedInvoices);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[API Invoices GET] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch invoices' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' } as ErrorResponse, { status: 401 });
    }

    const body: unknown = await request.json();

    const validation = invoiceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Données invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      } as ErrorResponse, { status: 400 });
    }

    const data = validation.data;

    try {
      const result = InvoiceService.createInvoice(data, session.userId, session.role);
      logAudit('CREATE', 'invoice', result.id, `Nouvelle facture créée: ${result.number}`, session.userId, session.name || session.username || null);
      return NextResponse.json(result);
    } catch (error: any) {
      if (error instanceof InvoiceServiceError) {
        return NextResponse.json({ error: error.message } as ErrorResponse, { status: error.status });
      }
      throw error;
    }

  } catch (error) {
    console.error('[API Invoices POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' } as ErrorResponse, { status: 500 });
  }
}
