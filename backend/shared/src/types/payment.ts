// ==========================================
// Payment Types
// ==========================================

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum PaymentMethod {
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  E_WALLET = "E_WALLET",
  COD = "COD",
  SEPAY_QR = "SEPAY_QR",
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
  provider?: string;
  qrCode?: string;
  transferContent?: string;
  paidAt?: string;
  expiredAt?: string;
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
