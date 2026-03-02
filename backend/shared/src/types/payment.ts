// ==========================================
// Payment Types
// ==========================================

export enum PaymentStatus {
  PENDING = "PENDING",
  AUTHORIZED = "AUTHORIZED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum PaymentMethod {
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  E_WALLET = "E_WALLET",
  COD = "COD",
}

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessPaymentRequest {
  orderId: string;
  customerId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
}
