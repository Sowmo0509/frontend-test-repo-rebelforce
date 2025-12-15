import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { SendChatDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly openRouterApiKey: string;
  private readonly openRouterModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openRouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY') ?? '';
    this.openRouterModel =
      this.configService.get<string>('OPENROUTER_MODEL') ??
      'openai/gpt-4o-mini';
  }

  async listSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: { id: true },
        },
      },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return session;
  }

  async deleteSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      return;
    }
    await this.prisma.chatMessage.deleteMany({
      where: { sessionId },
    });
    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });
    return { success: true };
  }

  async sendMessage(
    user: { id: string; email: string; role: string; name: string },
    dto: SendChatDto,
  ) {
    if (!this.openRouterApiKey) {
      throw new UnauthorizedException(
        'OpenRouter API key is not configured on the server',
      );
    }

    // Resolve or create chat session
    let sessionId = dto.sessionId;
    let sessionTitle: string | undefined;

    if (sessionId) {
      const existing = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });
      if (!existing) {
        // If the session does not belong to the user, ignore the provided id
        sessionId = undefined;
      } else {
        sessionTitle = existing.title;
      }
    }

    if (!sessionId) {
      sessionTitle = dto.message.slice(0, 80) || 'New Chat';
      const created = await this.prisma.chatSession.create({
        data: {
          userId: user.id,
          title: sessionTitle,
        },
      });
      sessionId = created.id;
    }

    // Persist the user message
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: dto.message,
      },
    });

    // Load recent conversation history
    const recentMessages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Optionally load document context
    let documentsContext = '';
    if (dto.documentIds && dto.documentIds.length > 0) {
      const docs = await this.prisma.document.findMany({
        where: { id: { in: dto.documentIds } },
        include: {
          fund: {
            select: { name: true, code: true },
          },
        },
      });

      if (docs.length > 0) {
        const lines = docs.map((doc) => {
          const fundLabel = doc.fund
            ? `${doc.fund.name} (${doc.fund.code})`
            : doc.fundId;
          return `- Title: ${doc.title}
  Fund: ${fundLabel}
  Type: ${doc.type}
  Status: ${doc.status}
  Period: ${doc.periodStart.toISOString()} – ${doc.periodEnd.toISOString()}
  Description: ${doc.description ?? 'n/a'}
`;
        });

        documentsContext = `The user has selected the following compliance documents to discuss:\n${lines.join(
          '\n',
        )}\nUse ONLY this information plus the conversation history to answer questions, and clearly say when information is not available in these documents.`;
      }
    }

    const systemPrompt = `You are an AI assistant helping with investment fund compliance documents inside an internal tool called Audit Vault.
Write responses in clear plain text without markdown formatting (no asterisks, headings, or bullet syntax).
Be concise and structured using short paragraphs.
Be precise and conservative: never invent document contents.
When asked about compliance, base your answers ONLY on the provided document metadata and user messages.
If something is unclear or not in the data, explicitly say what is missing.`;

    const messagesPayload: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (documentsContext) {
      messagesPayload.push({
        role: 'system',
        content: documentsContext,
      });
    }

    for (const m of recentMessages) {
      messagesPayload.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      });
    }

    try {
      const response = await axios.post<{
        choices?: { message?: { content?: string } }[];
      }>(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: this.openRouterModel,
          messages: messagesPayload,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3001',
            'X-Title': 'Audit Vault Chat',
          },
          timeout: 30000,
        },
      );

      const rawAssistantContent =
        response.data?.choices?.[0]?.message?.content ??
        'Sorry, I could not generate a response.';

      const assistantContent =
        this.sanitizeAssistantContent(rawAssistantContent);

      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: assistantContent,
        },
      });

      return {
        sessionId,
        sessionTitle,
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      // Surface a user-friendly message while logging the underlying error
      console.error('OpenRouter chat error', error);
      throw new InternalServerErrorException(
        'Failed to get a response from the AI assistant. Please try again later.',
      );
    }
  }

  // Fixing messy output from AI assitants like **text**, *text*, _text_ etc
  private sanitizeAssistantContent(content: string): string {
    if (!content) return content;

    // Remove bold/italic markers like **text**, *text*, _text_
    let cleaned = content.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/_(.+?)_/g, '$1');

    const lines = cleaned.split('\n').map((line) => {
      let current = line;

      // Remove markdown headings (e.g. "# Title", "## Section")
      current = current.replace(/^\s*#{1,6}\s+/, '');

      // Turn "- Title: q3 2025" into "Title: q3 2025"
      current = current.replace(/^\s*-\s+/, '');

      return current;
    });

    return lines.join('\n').trim();
  }
}
