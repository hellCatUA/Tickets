import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AttachmentDto,
  CommentDto,
  CreateTicketDto,
  DashboardDto,
  MeDto,
  TicketDetailDto,
  TicketListDto,
  TicketPriority,
  TicketStatus,
} from '@tickets/shared';
import type { Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { AccessService } from '../access/access.service';
import { TicketsService } from './tickets.service';

/** Shape of the multer in-memory upload (avoids depending on @types/multer). */
interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function attachmentsDir(): string {
  return process.env.ATTACHMENTS_DIR ?? '/data/attachments';
}

@Controller('api/tickets')
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly access: AccessService,
  ) {}

  private me(req: Request): Promise<MeDto> {
    return this.access.getMe(req.session.userId as string);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('status') status?: TicketStatus,
    @Query('categoryId') categoryId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
  ): Promise<TicketListDto> {
    return this.tickets.list(await this.me(req), {
      status,
      categoryId,
      assigneeId,
      q,
      page: page ? Number(page) : 1,
    });
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTicketDto): Promise<TicketDetailDto> {
    return this.tickets.create(await this.me(req), dto);
  }

  @Get(':id')
  async detail(@Req() req: Request, @Param('id') id: string): Promise<TicketDetailDto> {
    return this.tickets.getDetail(await this.me(req), id);
  }

  @Patch(':id/status')
  async status(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status: TicketStatus },
  ): Promise<TicketDetailDto> {
    return this.tickets.changeStatus(await this.me(req), id, body.status);
  }

  @Patch(':id/assign')
  async assign(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { assigneeId: string | null },
  ): Promise<TicketDetailDto> {
    return this.tickets.assign(await this.me(req), id, body.assigneeId ?? null);
  }

  @Patch(':id/category')
  async category(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { categoryId: string },
  ): Promise<TicketDetailDto> {
    return this.tickets.changeCategory(await this.me(req), id, body.categoryId);
  }

  @Patch(':id/object')
  async object(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { objectId: string | null },
  ): Promise<TicketDetailDto> {
    return this.tickets.changeObject(await this.me(req), id, body.objectId ?? null);
  }

  @Patch(':id/priority')
  async priority(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { priority: TicketPriority },
  ): Promise<TicketDetailDto> {
    return this.tickets.setPriority(await this.me(req), id, body.priority);
  }

  @Post(':id/comments')
  async comment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { body: string; internal?: boolean },
  ): Promise<CommentDto> {
    return this.tickets.addComment(await this.me(req), id, body.body, body.internal === true);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<AttachmentDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    // multer decodes filenames as latin1; recover UTF-8 originals.
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const storedName = `${randomUUID()}${extname(filename).slice(0, 10).toLowerCase()}`;
    const dir = attachmentsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, storedName), file.buffer);
    return this.tickets.registerAttachment(await this.me(req), id, {
      filename,
      storedName,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
    });
  }
}

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  async get(@Req() req: Request): Promise<DashboardDto> {
    const me = await this.access.getMe(req.session.userId as string);
    return this.tickets.dashboard(me);
  }
}

@Controller('api/attachments')
export class AttachmentsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly access: AccessService,
  ) {}

  @Get(':id/download')
  async download(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const me = await this.access.getMe(req.session.userId as string);
    const attachment = await this.tickets.getAttachmentForDownload(me, id);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    );
    createReadStream(join(attachmentsDir(), attachment.storedName)).pipe(res);
  }
}
