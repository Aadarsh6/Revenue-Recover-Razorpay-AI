import { LivePayment } from './stateValidator';
import prisma from '../lib/prismaClient';

interface PaymentContext {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  failureReason: string;
  errorCode: string | null;
  errorStep: string | null;
  errorSource: string | null;
  errorDescription: string | null;
}

interface CustomerContext {
  contact: string;
  previousSuccessfulPayments: number;
  successfulMethods: {
    upi: number;
    card: number;
  };
}

interface RecoveryContext {
  previousActions: string[];
}

export interface AggregatedContext {
  payment: PaymentContext;
  customer: CustomerContext;
  recovery: RecoveryContext;
}

export async function aggregateContext(livePayment: LivePayment): Promise<AggregatedContext> {
  // 1. Real Payment Facts
  const payment: PaymentContext = {
    id: livePayment.id,
    amount: livePayment.amount / 100,
    currency: livePayment.currency,
    method: livePayment.method,
    status: livePayment.status,
    failureReason: livePayment.error_reason || 'unknown',
    errorCode: null,
    errorStep: null,
    errorSource: null,
    errorDescription: null
  };

  // 2. Real Customer History (Query our DB)
  const customerIdentifier = livePayment.contact || livePayment.email;
  let customer: CustomerContext = {
    contact: customerIdentifier || 'unknown',
    previousSuccessfulPayments: 0,
    successfulMethods: { upi: 0, card: 0 }
  };

  if (customerIdentifier) {
    const pastPayments = await prisma.paymentRecord.findMany({
      where: {
        status: 'captured',
        OR: [ { contact: customerIdentifier }, { email: customerIdentifier } ]
      }
    });

    customer.previousSuccessfulPayments = pastPayments.length;
    pastPayments.forEach(p => {
      if (p.method === 'upi') customer.successfulMethods.upi++;
      if (p.method === 'card') customer.successfulMethods.card++;
    });
  }

  // 3. Recovery Context (Mocked empty for now)
  const recovery: RecoveryContext = {
    previousActions: []
  };

  return { payment, customer, recovery };
}