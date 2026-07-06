import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { sessionMiddleware } from './session';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind Nginx Proxy Manager: trust X-Forwarded-* for secure cookies.
  app.set('trust proxy', 1);

  // Allow embedding only from our own origin and the Nextcloud instance
  // (defence in depth — NPM sets the same header at the edge).
  const ncBaseUrl = process.env.NC_BASE_URL ?? process.env.OIDC_ISSUER;
  const frameAncestors = ncBaseUrl ? `'self' ${new URL(ncBaseUrl).origin}` : `'self'`;
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    next();
  });

  // Shared with the Socket.IO engine (see TicketsGateway.afterInit).
  app.use(sessionMiddleware());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`API listening on :${port}`);
}

void bootstrap();
