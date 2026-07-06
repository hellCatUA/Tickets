import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AccessService } from '../access/access.service';
import { sessionMiddleware } from '../session';
import { TicketsService } from './tickets.service';

interface SessionRequest {
  session?: { userId?: string };
}

/** Live ticket updates: clients join a room per ticket and get poked on changes. */
@WebSocketGateway()
export class TicketsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(TicketsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly access: AccessService,
    @Inject(forwardRef(() => TicketsService)) private readonly tickets: TicketsService,
  ) {}

  afterInit(server: Server): void {
    // Run the shared session middleware on the raw engine so handshakes are authenticated.
    (server as unknown as { engine: { use: (mw: unknown) => void } }).engine.use(
      sessionMiddleware(),
    );
  }

  handleConnection(socket: Socket): void {
    const userId = (socket.request as SessionRequest).session?.userId;
    if (!userId) {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('ticket:join')
  async join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() ticketId: string,
  ): Promise<{ ok: boolean }> {
    const userId = (socket.request as SessionRequest).session?.userId;
    if (!userId || typeof ticketId !== 'string') return { ok: false };
    try {
      const me = await this.access.getMe(userId);
      await this.tickets.assertCanView(me, ticketId);
      await socket.join(`ticket:${ticketId}`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  @SubscribeMessage('ticket:leave')
  async leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() ticketId: string,
  ): Promise<{ ok: boolean }> {
    if (typeof ticketId === 'string') await socket.leave(`ticket:${ticketId}`);
    return { ok: true };
  }

  emitTicketUpdate(ticketId: string, payload: Record<string, unknown>): void {
    this.server?.to(`ticket:${ticketId}`).emit('ticket:update', { ticketId, ...payload });
  }
}
