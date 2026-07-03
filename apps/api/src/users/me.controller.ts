import { Controller, Get, Req } from '@nestjs/common';
import type { MeDto } from '@tickets/shared';
import type { Request } from 'express';
import { AccessService } from '../access/access.service';

@Controller('api')
export class MeController {
  constructor(private readonly access: AccessService) {}

  @Get('me')
  me(@Req() req: Request): Promise<MeDto> {
    return this.access.getMe(req.session.userId as string);
  }
}
