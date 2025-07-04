import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface SendOtpEmailParams {
  to: string;
  otp: string;
  purpose: 'email_verification' | 'password_reset';
  firstName?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Check if email credentials are available
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailHost || !emailPort || !emailUser || !emailPass) {
      console.log('Email service not configured. OTP emails will be logged to console.');
      return;
    }

    const config: EmailConfig = {
      host: emailHost,
      port: parseInt(emailPort),
      secure: parseInt(emailPort) === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    };

    this.transporter = nodemailer.createTransport(config);
  }

  async sendOtpEmail({ to, otp, purpose, firstName }: SendOtpEmailParams): Promise<boolean> {
    const subject = purpose === 'email_verification' 
      ? 'Verifikasi Email - Rumah Psikologi Indonesia'
      : 'Reset Password - Rumah Psikologi Indonesia';

    const htmlContent = this.generateOtpEmailTemplate(otp, purpose, firstName);

    // If no transporter is configured, log to console for development
    if (!this.transporter) {
      console.log('\n=== EMAIL OTP (Development Mode) ===');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`OTP: ${otp}`);
      console.log(`Purpose: ${purpose}`);
      console.log('=====================================\n');
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html: htmlContent,
      });
      return true;
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      return false;
    }
  }

  private generateOtpEmailTemplate(otp: string, purpose: string, firstName?: string): string {
    const greeting = firstName ? `Halo ${firstName}` : 'Halo';
    
    const content = purpose === 'email_verification' 
      ? `
        <p>Terima kasih telah mendaftar di Rumah Psikologi Indonesia.</p>
        <p>Untuk melengkapi verifikasi email Anda, silakan masukkan kode OTP berikut:</p>
      `
      : `
        <p>Anda telah meminta untuk mereset password akun Anda di Rumah Psikologi Indonesia.</p>
        <p>Silakan masukkan kode OTP berikut untuk melanjutkan proses reset password:</p>
      `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>OTP Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: #ffffff; border: 2px solid #22c55e; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #16a34a; letter-spacing: 5px; margin: 10px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧠 Rumah Psikologi Indonesia</h1>
            <p>Platform Asesmen Psikologi Terpercaya</p>
          </div>
          <div class="content">
            <h2>${greeting},</h2>
            ${content}
            
            <div class="otp-box">
              <p><strong>Kode OTP Anda:</strong></p>
              <div class="otp-code">${otp}</div>
              <p><small>Kode ini berlaku selama 10 menit</small></p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Penting:</strong>
              <ul>
                <li>Jangan bagikan kode OTP ini kepada siapa pun</li>
                <li>Tim kami tidak akan pernah meminta kode OTP melalui telepon atau pesan</li>
                <li>Jika Anda tidak meminta verifikasi ini, abaikan email ini</li>
              </ul>
            </div>
            
            <p>Jika Anda mengalami kesulitan, silakan hubungi tim support kami.</p>
            
            <p>Salam hangat,<br>
            <strong>Tim Rumah Psikologi Indonesia</strong></p>
            
            <div class="footer">
              <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
              <p>&copy; ${new Date().getFullYear()} Rumah Psikologi Indonesia. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
export { EmailService };