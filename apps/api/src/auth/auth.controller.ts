import { Controller, Get, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../access/decorators';
import { UsersService } from '../users/users.service';
import { OidcService } from './oidc.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly oidc: OidcService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  /** Only allow same-app relative paths, so returnTo cannot become an open redirect. */
  private safeReturnTo(value?: string): string | undefined {
    if (value && value.startsWith('/') && !value.startsWith('//')) return value;
    return undefined;
  }

  @Public()
  @Get('login')
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Query('returnTo') returnTo?: string,
  ): Promise<void> {
    try {
      const url = await this.oidc.buildAuthorizationUrl(req.session, this.safeReturnTo(returnTo));
      res.redirect(url);
    } catch (err) {
      // Nextcloud unreachable / OIDC misconfigured — show a friendly message instead of a 500.
      this.logger.error(`Could not start OIDC flow: ${(err as Error).message}`);
      res.redirect('/login?error=oidc');
    }
  }

  @Public()
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const claims = await this.oidc.handleCallback(req);
      const groupsClaim = this.config.get<string>('OIDC_GROUPS_CLAIM') ?? 'groups';
      const rawGroups = claims[groupsClaim];
      const groups = Array.isArray(rawGroups) ? rawGroups.map(String) : [];
      const user = await this.users.upsertFromLogin({
        ncUid: claims.sub,
        displayName: (claims.name as string) || claims.sub,
        email: (claims.email as string) ?? null,
        groups,
      });
      const returnTo = req.session.oidc?.returnTo ?? '/';
      req.session.oidc = undefined;
      req.session.userId = user.id;
      res.redirect(returnTo);
    } catch (err) {
      this.logger.error(`OIDC callback failed: ${(err as Error).message}`);
      res.redirect('/login?error=oidc');
    }
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => res.status(204).end());
  }
}
