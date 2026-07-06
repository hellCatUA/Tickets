import { Controller, Get, Logger, NotFoundException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../access/decorators';

interface CachedImage {
  body: Buffer;
  type: string;
  fetchedAt: number;
}

const LOGO_TTL_MS = 60 * 60 * 1000;

/**
 * Serves the company logo. Until a custom upload exists (M4 branding
 * settings), the logo is pulled from Nextcloud's theming app and cached,
 * so the platform automatically matches the Nextcloud look.
 */
@Controller('api/branding')
export class BrandingController {
  private readonly logger = new Logger(BrandingController.name);
  private cache: CachedImage | null = null;

  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('logo')
  async logo(@Res() res: Response): Promise<void> {
    if (!this.cache || Date.now() - this.cache.fetchedAt > LOGO_TTL_MS) {
      const fetched = await this.fetchFromNextcloud();
      if (fetched) this.cache = fetched;
    }
    if (!this.cache) throw new NotFoundException('No logo available');
    res.setHeader('Content-Type', this.cache.type);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(this.cache.body);
  }

  private async fetchFromNextcloud(): Promise<CachedImage | null> {
    const base = (this.config.get<string>('NC_BASE_URL') ?? '').replace(/\/$/, '');
    if (!base) return null;
    const candidates = [
      '/index.php/apps/theming/image/logo',
      '/apps/theming/image/logo',
      '/core/img/logo/logo.png',
    ];
    for (const path of candidates) {
      try {
        const res = await fetch(`${base}${path}`, { redirect: 'follow' });
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.startsWith('image')) {
          this.logger.log(`Using Nextcloud logo from ${path}`);
          return { body: Buffer.from(await res.arrayBuffer()), type, fetchedAt: Date.now() };
        }
      } catch {
        // try the next candidate
      }
    }
    this.logger.warn('Could not fetch a logo from Nextcloud');
    return null;
  }
}
