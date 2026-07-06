import { Controller, Get } from '@nestjs/common';
import { Role, UserRefDto } from '@tickets/shared';
import { RequireRoles } from '../access/decorators';
import { UsersService } from './users.service';

/** Active user directory for assignment pickers — staff with Manager role and up. */
@Controller('api/users')
@RequireRoles(Role.Manager)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(): Promise<UserRefDto[]> {
    const users = await this.users.listUsers();
    return users.filter((u) => u.active).map((u) => ({ id: u.id, displayName: u.displayName }));
  }
}
