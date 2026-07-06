import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OcsUser {
  id: string;
  displayName: string;
  email: string | null;
  enabled: boolean;
  groups: string[];
}

export interface OcsGroup {
  id: string;
  displayName: string;
}

/** Thin client for the Nextcloud OCS Provisioning API (service account + app password). */
@Injectable()
export class OcsClient {
  private readonly logger = new Logger(OcsClient.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('NC_BASE_URL') &&
        this.config.get('NC_SERVICE_ACCOUNT') &&
        this.config.get('NC_SERVICE_APP_PASSWORD'),
    );
  }

  private async request<T>(path: string): Promise<T> {
    const base = this.config.getOrThrow<string>('NC_BASE_URL').replace(/\/$/, '');
    const auth = Buffer.from(
      `${this.config.getOrThrow('NC_SERVICE_ACCOUNT')}:${this.config.getOrThrow('NC_SERVICE_APP_PASSWORD')}`,
    ).toString('base64');
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${base}${path}${sep}format=json`, {
      headers: {
        Authorization: `Basic ${auth}`,
        'OCS-APIRequest': 'true',
        Accept: 'application/json',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      // Surface Nextcloud's own explanation (e.g. "Logged in account must be
      // an admin…") instead of a bare status code.
      let message = `HTTP ${res.status}`;
      try {
        const meta = (JSON.parse(text) as { ocs?: { meta?: { message?: string } } }).ocs?.meta;
        if (meta?.message) message += ` — ${meta.message}`;
      } catch {
        // non-JSON error body; keep the status only
      }
      throw new Error(`OCS request ${path} failed: ${message}`);
    }
    const body = JSON.parse(text) as { ocs: { data: T } };
    return body.ocs.data;
  }

  async listUserIds(): Promise<string[]> {
    const data = await this.request<{ users: string[] }>('/ocs/v2.php/cloud/users');
    return data.users ?? [];
  }

  async getUser(id: string): Promise<OcsUser> {
    const data = await this.request<{
      id?: string;
      displayname?: string;
      'display-name'?: string;
      email?: string | null;
      enabled?: boolean | string;
      groups?: string[];
    }>(`/ocs/v2.php/cloud/users/${encodeURIComponent(id)}`);
    return {
      id: data.id ?? id,
      displayName: data.displayname ?? data['display-name'] ?? id,
      email: data.email ?? null,
      enabled: data.enabled === true || data.enabled === 'true' || data.enabled === undefined,
      groups: data.groups ?? [],
    };
  }

  async listGroups(): Promise<OcsGroup[]> {
    // /groups/details also returns display names; fall back to plain ids on older servers.
    try {
      const data = await this.request<{ groups: Array<{ id: string; displayname?: string }> }>(
        '/ocs/v2.php/cloud/groups/details',
      );
      return (data.groups ?? []).map((g) => ({ id: g.id, displayName: g.displayname ?? g.id }));
    } catch (err) {
      this.logger.warn(`groups/details unavailable (${(err as Error).message}), falling back`);
      const data = await this.request<{ groups: string[] }>('/ocs/v2.php/cloud/groups');
      return (data.groups ?? []).map((id) => ({ id, displayName: id }));
    }
  }
}
