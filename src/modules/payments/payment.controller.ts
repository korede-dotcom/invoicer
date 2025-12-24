import { Controller, Post, Get, Body, Param, Headers, Query, HttpCode } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AllowAnonymous } from '@/decorators/allow-anonymous.decorator';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Generate payment link for an invoice
   * POST /api/payments/generate/:invoiceId
   */
  @Post('generate/:invoiceId')
  async generatePaymentLink(@Param('invoiceId') invoiceId: string) {
    try {
      const paymentLink = await this.paymentService.generatePaymentLink(invoiceId);
      
      return {
        success: true,
        message: 'Payment link generated successfully',
        paymentLink,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to generate payment link',
      };
    }
  }

  /**
   * Get payment status for an invoice
   * GET /api/payments/status/:invoiceId
   */
  @Get('status/:invoiceId')
  @AllowAnonymous()
  async getPaymentStatus(@Param('invoiceId') invoiceId: string) {
    try {
      const status = await this.paymentService.getPaymentStatus(invoiceId);
      
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get payment status',
      };
    }
  }

  /**
   * Verify payment transaction
   * GET /api/payments/verify/:transactionId
   */
  @Get('verify/:transactionId')
  @AllowAnonymous()
  async verifyPayment(
    @Param('transactionId') transactionId: string,
    @Query('company_id') companyId: string,
  ) {
    try {
      const paymentData = await this.paymentService.verifyPayment(transactionId, companyId);
      
      return {
        success: true,
        message: 'Payment verified successfully',
        data: paymentData,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Payment verification failed',
      };
    }
  }

  /**
   * Flutterwave webhook endpoint
   * POST /api/payments/webhook/flutterwave
   */
  @Post('webhook/flutterwave')
  @AllowAnonymous()
  @HttpCode(200)
  async handleFlutterwaveWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    try {
      await this.paymentService.handleWebhook(payload, signature);
      
      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      console.error('Webhook error:', error);
      return {
        success: false,
        message: 'Webhook processing failed',
      };
    }
  }

  /**
   * Resend payment link for an invoice
   * POST /api/payments/resend/:invoiceId
   */
  @Post('resend/:invoiceId')
  async resendPaymentLink(@Param('invoiceId') invoiceId: string) {
    try {
      // This will regenerate the payment link and send email
      const paymentLink = await this.paymentService.generatePaymentLink(invoiceId);
      
      // TODO: Send email with payment link
      
      return {
        success: true,
        message: 'Payment link resent successfully',
        paymentLink,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to resend payment link',
      };
    }
  }
}

