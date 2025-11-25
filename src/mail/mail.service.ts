import * as nodemailer from 'nodemailer';

import { Injectable } from '@nestjs/common';

interface MailOptions {
    to?: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: nodemailer.Attachment[];
}

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true', // true if port is 465
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }

    async sendMail(options: MailOptions) {
        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            ...options,
        };

        try {
            console.log(`📧 Attempting to send email to ${options.to}...`);
            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent successfully to ${options.to}`, result);
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw new Error('Failed to send email. Please check your SMTP configuration.');
        }

        return { message: 'Email sent successfully' };
    }

    async sendProjectWelcomeEmail(email: string, projectName: string, otp: string) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verificationLink = `${frontendUrl}/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`;

        const subject = 'Welcome to Your Project Portal - Verify Your Account';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
                    .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
                    .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
                    .button:hover { box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6); }
                    .divider { border-top: 1px solid #ddd; margin: 30px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to Your Project Portal!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${projectName}!</h2>
                        <p>Your project portal has been successfully created. You can now access your dashboard to view all clients, quotes, and invoices associated with your project.</p>

                        <div style="text-align: center; margin: 30px 0;">
                            <p style="font-size: 16px; margin-bottom: 20px;"><strong>Click the button below to verify your account and set your password:</strong></p>
                            <a href="${verificationLink}" class="button">✅ Verify Account & Set Password</a>
                            <p style="font-size: 12px; color: #999; margin-top: 10px;">This link is valid for 24 hours</p>
                        </div>

                        <div class="divider"></div>

                        <div style="text-align: center;">
                            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Or use this verification code manually:</p>
                            <div class="otp-box">
                                <p style="margin: 0; font-size: 14px; color: #666;">Your One-Time Password (OTP)</p>
                                <div class="otp-code">${otp}</div>
                                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 24 hours</p>
                            </div>
                        </div>

                        <div class="info-box">
                            <strong>📧 Login Email:</strong> ${email}<br>
                            <strong>🔐 First-Time Setup:</strong> Click the button above or use the OTP code to set your password
                        </div>

                        <h3>Next Steps:</h3>
                        <ol>
                            <li><strong>Click the verification button above</strong> (easiest method)</li>
                            <li>Or visit the project portal and enter your email: <strong>${email}</strong></li>
                            <li>Use the OTP code to verify and set your password</li>
                            <li>Access your dashboard to view clients, quotes, and invoices</li>
                        </ol>

                        <p><strong>What you can do in your portal:</strong></p>
                        <ul>
                            <li>✅ View all clients associated with your project</li>
                            <li>✅ Access all quotes and their status</li>
                            <li>✅ Track invoices and payment status</li>
                            <li>✅ Download reports and analytics</li>
                        </ul>

                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <strong>⚠️ Security Note:</strong> If you didn't request this account, please ignore this email or contact our support team.
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <p style="color: #666; font-size: 14px;">Need help? Contact our support team.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="font-size: 11px; color: #999; word-break: break-all;">${verificationLink}</p>
                        <p>&copy; ${new Date().getFullYear()} Invoicerr. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendMail({
            to: email,
            subject,
            html,
        });
    }
}