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
        const subject = 'Welcome to Your Project Portal - Login Credentials';
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
                    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
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

                        <div class="otp-box">
                            <p style="margin: 0; font-size: 14px; color: #666;">Your One-Time Password (OTP)</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 24 hours</p>
                        </div>

                        <div class="info-box">
                            <strong>📧 Login Email:</strong> ${email}<br>
                            <strong>🔐 First-Time Login:</strong> Use the OTP above to set your password
                        </div>

                        <h3>Next Steps:</h3>
                        <ol>
                            <li>Visit the project portal login page</li>
                            <li>Enter your email: <strong>${email}</strong></li>
                            <li>Use the OTP code above to verify and set your password</li>
                            <li>Access your dashboard to view clients, quotes, and invoices</li>
                        </ol>

                        <p><strong>What you can do in your portal:</strong></p>
                        <ul>
                            <li>✅ View all clients associated with your project</li>
                            <li>✅ Access all quotes and their status</li>
                            <li>✅ Track invoices and payment status</li>
                            <li>✅ Download reports and analytics</li>
                        </ul>

                        <div style="text-align: center; margin: 30px 0;">
                            <p style="color: #666; font-size: 14px;">Need help? Contact our support team.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
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