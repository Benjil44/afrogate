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
  AdminTelegramBotProfile,
  AdminTelegramTopupRequestResponse,
  AdminTelegramTopupRequestsResponse,
} from '@afrows/shared';
import type { RequestWithAuth } from '../security/auth-request';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { RejectTelegramTopupDto } from './dto/telegram-topup.dto';
import { UpdateTelegramBotProfileDto } from './dto/telegram-bot-profile.dto';
import { TelegramProfileService } from './telegram-profile.service';
import {
  TelegramTopupAdminService,
  type TelegramTopupListStatus,
} from './telegram-topup-admin.service';

@Controller('admin/telegram')
@UseGuards(AdminTokenGuard, RolesGuard)
export class TelegramTopupAdminController {
  constructor(
    private readonly topups: TelegramTopupAdminService,
    private readonly profiles: TelegramProfileService,
  ) {}

  /**
   * Resolve the bot's live Telegram profile (name / about / description) using
   * the server-stored token. Superadmin only. Returns `tokenConfigured: false`
   * with null fields when no token is saved (never 500s on a missing token).
   */
  @Get('bot-profile')
  @Roles('superadmin')
  async getBotProfile(): Promise<AdminTelegramBotProfile> {
    return this.profiles.getProfile();
  }

  /**
   * Publish the provided, changed profile fields to Telegram and return the
   * refreshed profile. Superadmin only; audited (field names only).
   */
  @Post('bot-profile')
  @Roles('superadmin')
  async publishBotProfile(
    @Body() body: UpdateTelegramBotProfileDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTelegramBotProfile> {
    return this.profiles.updateProfile(body, request.actor);
  }

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
