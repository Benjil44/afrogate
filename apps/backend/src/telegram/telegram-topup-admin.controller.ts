import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminTelegramTopupRequestResponse,
  AdminTelegramTopupRequestsResponse,
} from '@afrows/shared';
import type { RequestWithAuth } from '../security/auth-request';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { RejectTelegramTopupDto } from './dto/telegram-topup.dto';
import {
  TelegramTopupAdminService,
  type TelegramTopupListStatus,
} from './telegram-topup-admin.service';

@Controller('admin/telegram')
@UseGuards(AdminTokenGuard, RolesGuard)
export class TelegramTopupAdminController {
  constructor(private readonly topups: TelegramTopupAdminService) {}

  @Get('topups')
  @Roles('admin')
  async listTopups(@Query('status') status?: string): Promise<AdminTelegramTopupRequestsResponse> {
    return { requests: await this.topups.listRequests(this.normalizeStatus(status)) };
  }

  @Post('topups/:id/approve')
  @Roles('admin')
  async approveTopup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTelegramTopupRequestResponse> {
    return { request: await this.topups.approve(id, request.actor) };
  }

  @Post('topups/:id/reject')
  @Roles('admin')
  async rejectTopup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: RejectTelegramTopupDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTelegramTopupRequestResponse> {
    return { request: await this.topups.reject(id, body.reason ?? null, request.actor) };
  }

  @Get('topups/:id/receipt')
  @Roles('admin')
  async getReceipt(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    const { buffer, contentType } = await this.topups.getReceipt(id);
    return new StreamableFile(buffer, { type: contentType });
  }

  private normalizeStatus(status: string | undefined): TelegramTopupListStatus {
    switch (status) {
      case 'pending':
      case 'approved':
      case 'rejected':
      case 'awaiting_receipt':
      case 'all':
        return status;
      default:
        return 'pending';
    }
  }
}
