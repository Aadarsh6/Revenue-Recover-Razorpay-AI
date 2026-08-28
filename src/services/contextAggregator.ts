import { LivePayment } from './stateValidator';

interface PaymentContext {
  id: string;
  amount: number; // in rupees
  currency: string;
  method: string;
  status: string;
  failureReason: string;
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

// --- The Aggregator Function ---
export function aggregateContext(livePayment: LivePayment): AggregatedContext {
  // 1. Extract Payment Facts (convert paise to rupees)
  const payment: PaymentContext = {
    id: livePayment.id,
    amount: livePayment.amount / 100,
    currency: livePayment.currency,
    method: livePayment.method,
    status: livePayment.status,
    failureReason: 'payment_cancelled' // Mocked for demo
  };

  // 2. Extract/Query Customer Facts (Mocked for demo)
  const customer: CustomerContext = {
    contact: 'customer@example.com',
    previousSuccessfulPayments: 4,
    successfulMethods: {
      upi: 4,
      card: 0
    }
  };

  // 3. Extract Recovery Facts (Mocked empty for now)
  const recovery: RecoveryContext = {
    previousActions: []
  };

  return { payment, customer, recovery };
}