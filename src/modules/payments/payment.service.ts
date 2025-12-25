import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import prisma from '@/prisma/prisma.service';

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
   * Verify payment from Flutterwave
   */
  async verifyPayment(transactionId: string, companyId: string): Promise<any> {
    try {
      const config = await this.getFlutterwaveConfig(companyId);

      const response = await axios.get(
        `${this.flutterwaveBaseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
          },
        }
      );

      if (response.data.status === 'success') {
        return response.data.data;
      }

      throw new Error('Payment verification failed');
    } catch (error) {
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
            }),
          },
        });

        this.logger.log(`Invoice ${invoice.id} marked as PAID via Flutterwave`);

        // TODO: Send payment confirmation email to client
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
}
