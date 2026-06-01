import nodemailer from "nodemailer";
import { config } from "../config";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

function isSmtpConfigured() {
  return Boolean(config.smtp.user && config.smtp.pass);
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP credentials are not configured for NotificationService");
  }

  await transporter.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.user}>`,
    to,
    subject,
    html,
  });
}

export function renderPaymentSuccessEmail(params: {
  customerName?: string;
  orderCode: string;
  orderId: string;
  amount: number;
  transactionId: string;
}) {
  const customerName = params.customerName || "quý khách";
  const amount = params.amount.toLocaleString("vi-VN");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111827;">
      <h2 style="margin: 0 0 16px; color: #0f766e;">Thanh toán thành công</h2>
      <p>Xin chào ${customerName},</p>
      <p>TechSphere đã nhận được thanh toán cho đơn hàng <strong>${params.orderCode}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">Mã đơn hàng</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${params.orderCode}</strong></td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">Số tiền</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${amount} VND</strong></td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">Mã giao dịch</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${params.transactionId}</td>
        </tr>
      </table>
      <p>Đơn hàng của bạn đang được xử lý và sẽ được cập nhật trong trang lịch sử đơn hàng.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Order ID: ${params.orderId}</p>
    </div>
  `;
}
