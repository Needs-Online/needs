import { NextResponse } from 'next/server';
import { WalletService } from './wallet.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import {
  topupWalletSchema,
  requestPayoutSchema,
  listTransactionsQuerySchema,
} from './dto/wallet.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class WalletController {
  constructor(private readonly walletService: WalletService = new WalletService()) {}

  async getBalance(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const balance = await this.walletService.getWalletBalance(req.user.userId);
      return NextResponse.json(successResponse(balance, 'Wallet balance retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getTransactions(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const query = validateQuery(req, listTransactionsQuerySchema);
      const result = await this.walletService.getUserTransactions(req.user.userId, query);
      return NextResponse.json(successResponse(result, 'Transactions retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async topup(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, topupWalletSchema);
      const result = await this.walletService.topupWallet(req.user.userId, body);
      return NextResponse.json(successResponse(result, 'Wallet credited successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async requestPayout(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, requestPayoutSchema);
      const result = await this.walletService.requestPayout(
        req.user.userId,
        req.user.providerId,
        body
      );
      return NextResponse.json(successResponse(result, 'Payout requested successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
