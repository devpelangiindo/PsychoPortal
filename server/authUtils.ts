import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

export class AuthUtils {
  private static JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
  private static JWT_EXPIRES_IN = '7d';

  // Password hashing
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // JWT token management
  static generateAccessToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email, type: 'access' },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  static generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      this.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  static verifyToken(token: string): { userId: string; email?: string; type: string } | null {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as any;
      return {
        userId: payload.userId,
        email: payload.email,
        type: payload.type
      };
    } catch (error) {
      return null;
    }
  }

  // OTP generation
  static generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // User ID generation
  static generateUserId(): string {
    return nanoid(12);
  }

  // OTP expiration time (10 minutes from now)
  static getOtpExpirationTime(): Date {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate WhatsApp number format (Indonesian)
  static isValidWhatsAppNumber(number: string): boolean {
    // Remove spaces, dashes, and plus signs
    const cleanNumber = number.replace(/[\s\-\+]/g, '');
    
    // Check if it's a valid Indonesian mobile number
    // Format: 08xxxxxxxxxx or 628xxxxxxxxxx (10-13 digits after 08 or 628)
    const indonesianMobileRegex = /^(08|628)[0-9]{8,11}$/;
    return indonesianMobileRegex.test(cleanNumber);
  }

  // Normalize WhatsApp number to international format
  static normalizeWhatsAppNumber(number: string): string {
    const cleanNumber = number.replace(/[\s\-\+]/g, '');
    
    // Convert 08xxxxxxxxxx to 628xxxxxxxxxx
    if (cleanNumber.startsWith('08')) {
      return '62' + cleanNumber.substring(1);
    }
    
    // Already in 628xxxxxxxxxx format
    if (cleanNumber.startsWith('628')) {
      return cleanNumber;
    }
    
    // If it starts with 8, assume it's missing 62
    if (cleanNumber.startsWith('8') && cleanNumber.length >= 9) {
      return '62' + cleanNumber;
    }
    
    return cleanNumber;
  }

  // Generate session data for custom auth
  static generateSessionData(user: { id: string; email: string; firstName?: string; lastName?: string }) {
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      authProvider: 'custom',
      loginTime: new Date().toISOString()
    };
  }
}