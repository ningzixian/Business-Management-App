import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { AttachmentsService } from './attachments.service'

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('business-items/:itemId/attachments')
  @Roles('admin', 'manager', 'member')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    return this.attachments.upload(user, itemId, file, request)
  }

  @Get('attachments/:id')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const { metadata, stream } = await this.attachments.download(user, id)
    response.setHeader('Content-Type', metadata.mimeType)
    response.setHeader('Content-Length', metadata.sizeBytes)
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(metadata.fileName)}`)
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  }

  @Delete('attachments/:id')
  @Roles('admin', 'manager', 'member')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.attachments.remove(user, id, request)
  }
}
