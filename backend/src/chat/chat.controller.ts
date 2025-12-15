import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { SendChatDto } from './dto/chat.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  listSessions(@Req() req: any) {
    return this.chatService.listSessions(req.user.id);
  }

  @Get('sessions/:id')
  getSession(@Req() req: any, @Param('id') id: string) {
    return this.chatService.getSession(req.user.id, id);
  }

  @Delete('sessions/:id')
  deleteSession(@Req() req: any, @Param('id') id: string) {
    return this.chatService.deleteSession(req.user.id, id);
  }

  @Post('send')
  sendMessage(@Req() req: any, @Body() body: SendChatDto) {
    return this.chatService.sendMessage(req.user, body);
  }
}

