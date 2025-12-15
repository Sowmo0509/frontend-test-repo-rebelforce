import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

// The NestJS decorators use `any[]` internally for metadata, which triggers
// the no-unsafe-assignment rule even though these arrays are safe here.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
@Module({
  imports: [PrismaModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
