import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';
import { Client, generators, IdTokenClaims, Issuer } from 'openid-client';

type AppSession = Session & Partial<SessionData>;

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private client?: Client;
  private clientPromise?: Promise<Client>;

  constructor(private readonly config: ConfigService) {}

  private get redirectUri(): string {
    return `${this.config.getOrThrow<string>('PUBLIC_URL')}/auth/callback`;
  }

  /** Lazy discovery with retry-on-next-request, so the API boots even if Nextcloud is down. */
  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    this.clientPromise ??= this.discover().catch((err) => {
      this.clientPromise = undefined;
      throw err;
    });
    this.client = await this.clientPromise;
    return this.client;
  }

  private async discover(): Promise<Client> {
    const issuer = this.config.getOrThrow<string>('OIDC_ISSUER');
    const discoveryUrl =
      this.config.get<string>('OIDC_DISCOVERY_URL') ||
      `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    this.logger.log(`Discovering OIDC configuration at ${discoveryUrl}`);
    const discovered = await Issuer.discover(discoveryUrl);
    return new discovered.Client({
      client_id: this.config.getOrThrow<string>('OIDC_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('OIDC_CLIENT_SECRET'),
      redirect_uris: [this.redirectUri],
      response_types: ['code'],
    });
  }

  async buildAuthorizationUrl(session: AppSession, returnTo?: string): Promise<string> {
    const client = await this.getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    session.oidc = { state, nonce, codeVerifier, returnTo };
    return client.authorizationUrl({
      scope: this.config.get<string>('OIDC_SCOPES') ?? 'openid profile email groups',
      state,
      nonce,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });
  }

  async handleCallback(req: Request): Promise<IdTokenClaims> {
    const pending = req.session.oidc;
    if (!pending) {
      throw new UnauthorizedException('No pending OIDC authorization in session');
    }
    const client = await this.getClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(this.redirectUri, params, {
      state: pending.state,
      nonce: pending.nonce,
      code_verifier: pending.codeVerifier,
    });
    return tokenSet.claims();
  }
}
