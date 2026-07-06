import type { NotificationDto } from '@tickets/shared';
import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { NotificationsApi } from '../lib/api';

let socket: Socket | null = null;

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotificationDto[],
    unreadCount: 0,
    loaded: false,
  }),
  actions: {
    /** Connect once per session; live pushes arrive over the shared WebSocket. */
    connect(): void {
      if (socket) return;
      socket = io({ path: '/socket.io' });
      socket.on('notification:new', () => void this.refresh());
      void this.refresh();
    },
    async refresh(): Promise<void> {
      const res = await NotificationsApi.list();
      this.items = res.items;
      this.unreadCount = res.unreadCount;
      this.loaded = true;
    },
    async markAllRead(): Promise<void> {
      const { unreadCount } = await NotificationsApi.markRead();
      this.unreadCount = unreadCount;
      this.items = this.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
    },
    async markRead(id: string): Promise<void> {
      const { unreadCount } = await NotificationsApi.markRead([id]);
      this.unreadCount = unreadCount;
      const item = this.items.find((n) => n.id === id);
      if (item && !item.readAt) item.readAt = new Date().toISOString();
    },
  },
});
