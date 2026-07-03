import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisStore } from 'connect-redis';
import type { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { AppModule } from './app.module';

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

  // Sessions: Redis-backed in normal operation, in-memory fallback for bare local dev.
  let store: session.Store | undefined;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    await redisClient.connect();
    store = new RedisStore({ client: redisClient, prefix: 'tickets:sess:' });
  } else {
    logger.warn('REDIS_URL not set — using in-memory session store (dev only)');
  }
  const isProd = process.env.NODE_ENV === 'production';
  app.use(
    session({
      store,
      name: 'tickets.sid',
      secret: process.env.SESSION_SECRET ?? 'dev-only-secret',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`API listening on :${port}`);
}

void bootstrap();
