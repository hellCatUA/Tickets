import { Logger } from '@nestjs/common';
import { RedisStore } from 'connect-redis';
import type { RequestHandler } from 'express';
import session from 'express-session';
import { createClient } from 'redis';

let built: Promise<RequestHandler> | undefined;

async function build(): Promise<RequestHandler> {
  const logger = new Logger('Session');
  let store: session.Store | undefined;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const client = createClient({ url: redisUrl });
    client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    await client.connect();
    store = new RedisStore({ client, prefix: 'tickets:sess:' });
  } else {
    logger.warn('REDIS_URL not set — using in-memory session store (dev only)');
  }
  const isProd = process.env.NODE_ENV === 'production';
  return session({
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
  });
}

/**
 * Lazily-built singleton session middleware, shared by the HTTP stack and the
 * Socket.IO engine so WebSocket handshakes carry the same session.
 */
export function sessionMiddleware(): RequestHandler {
  return (req, res, next) => {
    (built ??= build()).then((mw) => mw(req, res, next)).catch(next);
  };
}
