import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission, Role } from '@tickets/shared';
import type { Request } from 'express';
import { AccessService } from './access.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from './decorators';

/** Global guard: requires a session for every route unless @Public(), plus roles from @RequireRoles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedException();

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    const requiredPerms = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    if (!requiredRoles?.length && !requiredPerms?.length) return true;

    const me = await this.access.getMe(userId);
    if (requiredRoles?.length && !requiredRoles.some((role) => me.roles.includes(role))) {
      throw new ForbiddenException('Insufficient role');
    }
    if (requiredPerms?.length && !requiredPerms.some((p) => me.permissions.includes(p))) {
      throw new ForbiddenException('Missing permission');
    }
    return true;
  }
}
