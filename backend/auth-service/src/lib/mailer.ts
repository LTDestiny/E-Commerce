import nodemailer from "nodemailer";
import { config } from "../config";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure, // true for port 465, false for other ports
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

// Verify connection configuration on startup
if (config.smtp.user && config.smtp.pass) {
  transporter.verify((error) => {
    if (error) {
      console.error("[AuthService] SMTP Transporter connection verification failed:", error);
    } else {
      console.log("[AuthService] SMTP Transporter is ready to deliver messages");
    }
  });
} else {
  console.warn("[AuthService] SMTP credentials are not fully configured in environment. Emails will fail to send.");
}

export async function sendResetPasswordEmail(email: string, resetLink: string): Promise<void> {
  const mailOptions = {
    from: `"TechSphere Support" <${config.smtp.user || "no-reply@techsphere.com"}>`,
    to: email,
    subject: "Yêu cầu khôi phục mật khẩu - TechSphere",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #333333; text-align: center;">Khôi phục mật khẩu TechSphere</h2>
        <p>Xin chào,</p>
        <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn tại TechSphere. Vui lòng nhấp vào nút dưới đây để thiết lập mật khẩu mới:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
        </div>
        <p>Hoặc sao chép đường dẫn này vào trình duyệt của bạn:</p>
        <p style="word-break: break-all; color: #0070f3;">${resetLink}</p>
        <p style="color: #666666; font-size: 13px;">Liên kết này có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu thay đổi này, bạn có thể an tâm bỏ qua email này.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="color: #999999; font-size: 12px; text-align: center;">© 2026 TechSphere E-Commerce. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
