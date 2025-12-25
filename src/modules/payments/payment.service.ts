import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import prisma from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';

interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
}

interface PaymentLinkData {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    name: string;
  };
  customizations: {
    title: string;
    description: string;
    logo?: string;
  };
  meta?: any;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly flutterwaveBaseUrl = 'https://api.flutterwave.com/v3';

  constructor(private readonly mailService: MailService) {}

  /**
   * Get Flutterwave configuration for a company
   * Falls back to system default if company doesn't have custom keys
   */
  private async getFlutterwaveConfig(companyId: string): Promise<FlutterwaveConfig> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        flutterwavePublicKey: true,
        flutterwaveSecretKey: true,
        flutterwaveEncryptionKey: true,
        useSystemPaymentGateway: true,
      },
    });

    // Use company's own keys if configured and not using system default
    if (
      company &&
      !company.useSystemPaymentGateway &&
      company.flutterwavePublicKey &&
      company.flutterwaveSecretKey
    ) {
      return {
        publicKey: company.flutterwavePublicKey,
        secretKey: company.flutterwaveSecretKey,
        encryptionKey: company.flutterwaveEncryptionKey || '',
      };
    }

    // Fall back to system default keys
    return {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
      encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
    };
  }

  /**
   * Detect currency based on client's country
   */
  getCurrencyFromCountry(country: string): string {
    const currencyMap: Record<string, string> = {
      // Africa
      'Nigeria': 'NGN',
      'Ghana': 'GHS',
      'Kenya': 'KES',
      'South Africa': 'ZAR',
      'Uganda': 'UGX',
      'Tanzania': 'TZS',
      'Rwanda': 'RWF',
      'Zambia': 'ZMW',
      
      // Europe
      'United Kingdom': 'GBP',
      'France': 'EUR',
      'Germany': 'EUR',
      'Spain': 'EUR',
      'Italy': 'EUR',
      'Netherlands': 'EUR',
      'Belgium': 'EUR',
      'Portugal': 'EUR',
      'Ireland': 'EUR',
      'Austria': 'EUR',
      
      // Americas
      'United States': 'USD',
      'Canada': 'CAD',
      'Mexico': 'MXN',
      'Brazil': 'BRL',
      
      // Default
      'default': 'USD',
    };

    return currencyMap[country] || currencyMap['default'];
  }

  /**
   * Generate payment link for an invoice
   */
  async generatePaymentLink(invoiceId: string): Promise<string> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          company: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const config = await this.getFlutterwaveConfig(invoice.companyId);

      // Validate Flutterwave configuration
      if (!config.secretKey || config.secretKey.trim() === '') {
        this.logger.error('Flutterwave secret key is not configured');
        throw new Error(
          'Payment gateway is not configured. Please contact support or configure Flutterwave keys in company settings.'
        );
      }

      if (!config.publicKey || config.publicKey.trim() === '') {
        this.logger.error('Flutterwave public key is not configured');
        throw new Error(
          'Payment gateway is not configured. Please contact support or configure Flutterwave keys in company settings.'
        );
      }

      this.logger.log(`Generating payment link for invoice ${invoiceId}`);
      this.logger.log(`Using Flutterwave public key: ${config.publicKey.substring(0, 10)}...`);

      // Generate unique transaction reference
      const txRef = `INV-${invoice.rawNumber || invoice.number}-${Date.now()}`;

      // Determine currency based on client country or invoice currency
      const currency = invoice.currency || this.getCurrencyFromCountry(invoice.client.country);

      // Frontend callback URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/payment/callback?invoice_id=${invoiceId}`;

      const paymentData: PaymentLinkData = {
        tx_ref: txRef,
        amount: invoice.totalTTC,
        currency,
        redirect_url: redirectUrl,
        customer: {
          email: invoice.client.contactEmail,
          name: invoice.client.name,
        },
        customizations: {
          title: `Invoice Payment - ${invoice.rawNumber || invoice.number}`,
          description: `Payment for invoice ${invoice.rawNumber || invoice.number}`,
          logo: invoice.company.email, // You can add company logo URL here
        },
        meta: {
          invoice_id: invoiceId,
          company_id: invoice.companyId,
          client_id: invoice.clientId,
        },
      };

      // Create payment link via Flutterwave API
      this.logger.log(`Calling Flutterwave API: POST ${this.flutterwaveBaseUrl}/payments`);

      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/payments`,
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        const paymentLink = response.data.data.link;

        // Update invoice with payment details
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            paymentGateway: 'flutterwave',
            paymentReference: txRef,
            paymentLink,
            paymentLinkExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });

        this.logger.log(`Payment link generated for invoice ${invoiceId}: ${paymentLink}`);
        return paymentLink;
      }

      throw new Error('Failed to generate payment link');
    } catch (error) {
      // Enhanced error logging for Flutterwave API errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        this.logger.error(`Flutterwave API Error Response:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });

        if (error.response.status === 401) {
          throw new Error(
            'Flutterwave authentication failed. Please check your API keys in the company settings or environment variables.'
          );
        }

        if (error.response.data?.message) {
          throw new Error(`Flutterwave API Error: ${error.response.data.message}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        this.logger.error(`No response from Flutterwave API:`, error.request);
        throw new Error('Unable to connect to Flutterwave payment gateway. Please try again later.');
      }

      this.logger.error(`Error generating payment link: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify payment from Flutterwave and update invoice status
   */
  async verifyPayment(transactionId: string, companyId: string): Promise<any> {
    try {
      const config = await this.getFlutterwaveConfig(companyId);

      this.logger.log(`Verifying payment transaction: ${transactionId}`);

      const response = await axios.get(
        `${this.flutterwaveBaseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
          },
        }
      );

      if (response.data.status === 'success') {
        const paymentData = response.data.data;

        // If payment is successful, update invoice status
        if (paymentData.status === 'successful') {
          const { tx_ref, amount, currency, customer } = paymentData;

          // Find invoice by payment reference
          const invoice = await prisma.invoice.findFirst({
            where: { paymentReference: tx_ref },
          });

          if (invoice) {
            // Verify amount matches
            if (invoice.totalTTC === amount) {
              // Update invoice status to PAID
              await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                  status: 'PAID',
                  paidAt: new Date(),
                  paymentMethod: 'Flutterwave',
                  paymentDetails: JSON.stringify({
                    transaction_id: paymentData.id,
                    flw_ref: paymentData.flw_ref,
                    customer_email: customer.email,
                    verified_at: new Date().toISOString(),
                  }),
                },
              });

              this.logger.log(`Invoice ${invoice.id} marked as PAID via manual verification`);

              // Send payment confirmation emails
              await Promise.all([
                this.sendPaymentConfirmationToClient(invoice.id),
                this.sendPaymentNotificationToAdmin(invoice.id),
              ]);

              this.logger.log(`Payment confirmation emails sent for invoice ${invoice.id}`);
            } else {
              this.logger.error(
                `Payment amount mismatch for invoice ${invoice.id}. Expected: ${invoice.totalTTC}, Received: ${amount}`
              );
            }
          } else {
            this.logger.warn(`Invoice not found for payment reference: ${tx_ref}`);
          }
        }

        return paymentData;
      }

      throw new Error('Payment verification failed');
    } catch (error) {
      if (error.response) {
        this.logger.error(`Flutterwave verification error:`, {
          status: error.response.status,
          data: error.response.data,
        });
      }
      this.logger.error(`Error verifying payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle payment webhook from Flutterwave
   */
  async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || '';

      if (signature !== secretHash) {
        throw new Error('Invalid webhook signature');
      }

      const { event, data } = payload;

      if (event === 'charge.completed' && data.status === 'successful') {
        const { tx_ref, amount, currency, customer } = data;

        // Find invoice by payment reference
        const invoice = await prisma.invoice.findFirst({
          where: { paymentReference: tx_ref },
        });

        if (!invoice) {
          this.logger.warn(`Invoice not found for payment reference: ${tx_ref}`);
          return;
        }

        // Verify amount matches
        if (invoice.totalTTC !== amount) {
          this.logger.error(
            `Payment amount mismatch for invoice ${invoice.id}. Expected: ${invoice.totalTTC}, Received: ${amount}`
          );
          return;
        }

        // Update invoice status to PAID
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentMethod: 'Flutterwave',
            paymentDetails: JSON.stringify({
              transaction_id: data.id,
              flw_ref: data.flw_ref,
              customer_email: customer.email,
              verified_at: new Date().toISOString(),
            }),
          },
        });

        this.logger.log(`Invoice ${invoice.id} marked as PAID via Flutterwave`);

        // Send payment confirmation emails
        await Promise.all([
          this.sendPaymentConfirmationToClient(invoice.id),
          this.sendPaymentNotificationToAdmin(invoice.id),
        ]);

        this.logger.log(`Payment confirmation emails sent for invoice ${invoice.id}`);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payment status for an invoice
   */
  async getPaymentStatus(invoiceId: string): Promise<any> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        status: true,
        paymentReference: true,
        paymentGateway: true,
        paidAt: true,
        paymentMethod: true,
        paymentLink: true,
        paymentLinkExpiry: true,
      },
    });

    return invoice;
  }

  /**
   * Send payment confirmation email to client
   */
  async sendPaymentConfirmationToClient(invoiceId: string): Promise<void> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          company: true,
        },
      });

      if (!invoice) {
        this.logger.error(`Invoice not found: ${invoiceId}`);
        return;
      }

      const subject = `Payment Confirmed - Invoice #${invoice.rawNumber || invoice.number}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 { margin: 0; font-size: 28px; }
            .header .icon { font-size: 48px; margin-bottom: 10px; }
            .content { padding: 40px 30px; background: #f9fafb; }
            .success-box {
              background: white;
              border: 2px solid #10b981;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
              text-align: center;
            }
            .success-box h2 { margin: 0 0 10px 0; color: #10b981; font-size: 24px; }
            .invoice-details {
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
            }
            .invoice-details table { width: 100%; border-collapse: collapse; }
            .invoice-details td { padding: 8px 0; font-size: 14px; }
            .invoice-details td:first-child { color: #6b7280; }
            .invoice-details td:last-child { text-align: right; font-weight: bold; color: #111827; }
            .amount { font-size: 32px; font-weight: bold; color: #10b981; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">✅</div>
              <h1>Payment Received!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Thank you for your payment</p>
            </div>

            <div class="content">
              <h2 style="margin-top: 0;">Dear ${invoice.client.name},</h2>
              <p>We have successfully received your payment for invoice #${invoice.rawNumber || invoice.number}.</p>

              <div class="success-box">
                <h2>Payment Confirmed</h2>
                <p class="amount">${invoice.currency} ${invoice.totalTTC.toLocaleString()}</p>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Paid on ${new Date().toLocaleDateString()}</p>
              </div>

              <div class="invoice-details">
                <table>
                  <tr>
                    <td>Invoice Number</td>
                    <td>${invoice.rawNumber || invoice.number}</td>
                  </tr>
                  <tr>
                    <td>Payment Method</td>
                    <td>Flutterwave</td>
                  </tr>
                  <tr>
                    <td>Payment Reference</td>
                    <td>${invoice.paymentReference || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>From</td>
                    <td>${invoice.company.name}</td>
                  </tr>
                </table>
              </div>

              <p>A receipt for this payment will be sent to you separately.</p>

              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>${invoice.company.name}</strong>
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0;">This is an automated payment confirmation</p>
              <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} ${invoice.company.name}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.mailService.sendMail({
        to: invoice.client.contactEmail,
        subject,
        html,
      });

      this.logger.log(`Payment confirmation email sent to client: ${invoice.client.contactEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation to client: ${error.message}`);
      // Don't throw - email failure shouldn't stop payment processing
    }
  }

  /**
   * Send payment notification email to admin
   */
  async sendPaymentNotificationToAdmin(invoiceId: string): Promise<void> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          company: true,
        },
      });

      if (!invoice) {
        this.logger.error(`Invoice not found: ${invoiceId}`);
        return;
      }

      // Get admin email from company or environment
      const adminEmail = invoice.company.email || process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        this.logger.warn('No admin email configured for payment notifications');
        return;
      }

      const subject = `💰 Payment Received - Invoice #${invoice.rawNumber || invoice.number}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; background: #f9fafb; }
            .payment-box {
              background: white;
              border: 2px solid #10b981;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
            }
            .payment-box table { width: 100%; border-collapse: collapse; }
            .payment-box td { padding: 8px 0; font-size: 14px; }
            .payment-box td:first-child { color: #6b7280; }
            .payment-box td:last-child { text-align: right; font-weight: bold; color: #111827; }
            .amount { font-size: 32px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Payment Received</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">New payment notification</p>
            </div>

            <div class="content">
              <h2 style="margin-top: 0;">Payment Received!</h2>
              <p>A payment has been successfully received via Flutterwave.</p>

              <div class="amount">${invoice.currency} ${invoice.totalTTC.toLocaleString()}</div>

              <div class="payment-box">
                <table>
                  <tr>
                    <td>Invoice Number</td>
                    <td>${invoice.rawNumber || invoice.number}</td>
                  </tr>
                  <tr>
                    <td>Client</td>
                    <td>${invoice.client.name}</td>
                  </tr>
                  <tr>
                    <td>Client Email</td>
                    <td>${invoice.client.contactEmail}</td>
                  </tr>
                  <tr>
                    <td>Payment Method</td>
                    <td>Flutterwave</td>
                  </tr>
                  <tr>
                    <td>Payment Reference</td>
                    <td>${invoice.paymentReference || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Payment Date</td>
                    <td>${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <p>The invoice has been automatically marked as PAID in the system.</p>

              <p style="margin-top: 30px;">
                <strong>${invoice.company.name}</strong>
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0;">This is an automated payment notification</p>
              <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} ${invoice.company.name}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.mailService.sendMail({
        to: adminEmail,
        subject,
        html,
      });

      this.logger.log(`Payment notification email sent to admin: ${adminEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send payment notification to admin: ${error.message}`);
      // Don't throw - email failure shouldn't stop payment processing
    }
  }
}
