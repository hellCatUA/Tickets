import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';
import { Client, generators, IdTokenClaims, Issuer, IssuerMetadata } from 'openid-client';

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

  /**
   * Candidate discovery URLs. Nextcloud serves the OIDC app's discovery
   * document on different paths depending on whether /.well-known rewrites
   * are configured in its web server, so unless OIDC_DISCOVERY_URL pins one
   * explicitly we probe the known variants.
   */
  private discoveryCandidates(): string[] {
    const explicit = this.config.get<string>('OIDC_DISCOVERY_URL');
    if (explicit) return [explicit];
    const base = this.config.getOrThrow<string>('OIDC_ISSUER').replace(/\/$/, '');
    return [
      `${base}/.well-known/openid-configuration`,
      `${base}/index.php/.well-known/openid-configuration`,
      `${base}/index.php/apps/oidc/openid-configuration`,
      `${base}/apps/oidc/openid-configuration`,
    ];
  }

  /**
   * Fetch the discovery document ourselves: openid-client's Issuer.discover()
   * appends /.well-known/openid-configuration to URLs that lack it, which
   * breaks Nextcloud's app-route discovery paths.
   */
  private async fetchIssuer(url: string): Promise<Issuer> {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const metadata = (await res.json()) as IssuerMetadata;
    if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
      throw new Error('response is not an OIDC discovery document');
    }
    return new Issuer(metadata);
  }

  private async discover(): Promise<Client> {
    let lastError: Error | undefined;
    for (const url of this.discoveryCandidates()) {
      try {
        const issuer = await this.fetchIssuer(url);
        this.logger.log(`OIDC discovery succeeded at ${url}`);
        return new issuer.Client({
          client_id: this.config.getOrThrow<string>('OIDC_CLIENT_ID'),
          client_secret: this.config.getOrThrow<string>('OIDC_CLIENT_SECRET'),
          redirect_uris: [this.redirectUri],
          response_types: ['code'],
        });
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`OIDC discovery failed at ${url}: ${lastError.message}`);
      }
    }
    throw lastError ?? new Error('OIDC discovery failed');
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
