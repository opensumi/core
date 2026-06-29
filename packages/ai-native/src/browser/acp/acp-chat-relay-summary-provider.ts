import { Autowired, Injectable } from '@opensumi/di';
import { AIBackSerivcePath, IACPConfigProvider, IAIBackService, ILogger } from '@opensumi/ide-core-common';
import { ChatMessageRole, IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

type AcpChatRelayDigestSource = 'memory_summary' | 'background_summary' | 'empty';

interface AcpChatRelayMemorySummary {
  content: string;
  timestamp: number;
  messageIds: string[];
}

export interface AcpChatRelaySummarySession {
  sessionId: string;
  title?: string;
  history: {
    getMemorySummaries(): AcpChatRelayMemorySummary[];
    getMessages(): IHistoryChatMessage[];
  };
}

export interface AcpChatRelaySummaryOptions {
  maxSourceChars?: number;
  maxDigestChars?: number;
}

export interface AcpChatRelaySummaryResult {
  digestSource: AcpChatRelayDigestSource;
  digest: string;
  digestChars: number;
  sourceChars: number;
  sourceTruncated: boolean;
}

interface BoundedSourceMaterial {
  messages: Array<{ role: ChatMessageRole; content: string }>;
  sourceChars: number;
  sourceTruncated: boolean;
}

const DEFAULT_MAX_SOURCE_CHARS = 12000;
const MAX_SOURCE_CHARS_CAP = 30000;
const DEFAULT_MAX_DIGEST_CHARS = 2000;
const MAX_DIGEST_CHARS_CAP = 6000;
const MAX_MESSAGE_CHARS = 800;

function stripAcpPrefix(sessionId: string | undefined): string | undefined {
  return sessionId?.startsWith('acp:') ? sessionId.slice(4) : sessionId;
}

@Injectable()
export class AcpChatRelaySummaryProvider {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(AIBackSerivcePath)
  private readonly aiBackService: IAIBackService;

  @Autowired(IACPConfigProvider)
  private readonly configProvider: IACPConfigProvider | undefined;

  async prepareSessionDigest(
    session: AcpChatRelaySummarySession,
    options: AcpChatRelaySummaryOptions = {},
  ): Promise<AcpChatRelaySummaryResult> {
    const startedAt = Date.now();
    const limits = this.normalizeLimits(options);
    this.log(
      `[WebMCP][acp_chat][relay_summary] prepare start — sourceSessionId=${stripAcpPrefix(
        session.sessionId,
      )}, maxSourceChars=${limits.maxSourceChars}, maxDigestChars=${
        limits.maxDigestChars
      }, memorySummaries=${this.getMemorySummaryCount(session)}, historyMessages=${this.getHistoryMessageCount(
        session,
      )}`,
    );

    const memoryDigest = this.buildMemoryDigest(session, limits.maxDigestChars);
    if (memoryDigest) {
      const sourceChars = this.getMemorySourceChars(session);
      const sourceTruncated = sourceChars > limits.maxDigestChars;
      this.log(
        `[WebMCP][acp_chat][relay_summary] prepare done — sourceSessionId=${stripAcpPrefix(
          session.sessionId,
        )}, digestSource=memory_summary, sourceChars=${sourceChars}, digestChars=${
          memoryDigest.length
        }, sourceTruncated=${sourceTruncated}, durationMs=${Date.now() - startedAt}`,
      );
      return {
        digestSource: 'memory_summary',
        digest: memoryDigest,
        digestChars: memoryDigest.length,
        sourceChars,
        sourceTruncated,
      };
    }

    const source = this.buildBoundedSourceMaterial(session, limits.maxSourceChars);
    if (source.messages.length === 0) {
      this.warn(
        `[WebMCP][acp_chat][relay_summary] prepare empty — sourceSessionId=${stripAcpPrefix(
          session.sessionId,
        )}, reason=no_source_messages, sourceChars=${source.sourceChars}, sourceTruncated=${
          source.sourceTruncated
        }, durationMs=${Date.now() - startedAt}`,
      );
      return this.emptyResult(source);
    }

    const digest = await this.summarizeMessages(session, source.messages, limits.maxDigestChars);
    if (!digest) {
      this.warn(
        `[WebMCP][acp_chat][relay_summary] prepare empty — sourceSessionId=${stripAcpPrefix(
          session.sessionId,
        )}, reason=summary_unavailable, messageCount=${source.messages.length}, sourceChars=${
          source.sourceChars
        }, sourceTruncated=${source.sourceTruncated}, durationMs=${Date.now() - startedAt}`,
      );
      return this.emptyResult(source);
    }

    this.log(
      `[WebMCP][acp_chat][relay_summary] prepare done — sourceSessionId=${stripAcpPrefix(
        session.sessionId,
      )}, digestSource=background_summary, messageCount=${source.messages.length}, sourceChars=${
        source.sourceChars
      }, digestChars=${digest.length}, sourceTruncated=${source.sourceTruncated}, durationMs=${Date.now() - startedAt}`,
    );

    return {
      digestSource: 'background_summary',
      digest,
      digestChars: digest.length,
      sourceChars: source.sourceChars,
      sourceTruncated: source.sourceTruncated,
    };
  }

  private async summarizeMessages(
    session: AcpChatRelaySummarySession,
    messages: Array<{ role: ChatMessageRole; content: string }>,
    maxDigestChars: number,
  ): Promise<string> {
    const requestId = `acp_chat_prepare_digest_${Date.now()}`;
    const startedAt = Date.now();
    const sourceChars = messages.reduce((total, message) => total + message.content.length, 0);
    const prompt = `/compact

Summarize this ACP chat session for forwarding into another OpenSumi chat.

Requirements:
- Write concise Chinese unless the source is clearly English-only.
- Preserve concrete decisions, completed work, blockers, and next steps.
- Do not include raw tool outputs, secrets, credentials, or long code blocks.
- Do not mention that this is a summary task.
- Keep the result under ${maxDigestChars} characters.`;

    try {
      const agentSessionConfig = await this.configProvider?.resolveConfig();
      const requestInput = `${prompt}

Source session:
- id: ${session.sessionId}
- title: ${session.title || '(untitled)'}

Messages:
${this.formatMessagesForSummary(messages)}`;

      this.log(
        `[WebMCP][acp_chat][relay_summary] request start — requestId=${requestId}, sourceSessionId=${stripAcpPrefix(
          session.sessionId,
        )}, messageCount=${messages.length}, sourceChars=${sourceChars}, requestChars=${
          requestInput.length
        }, maxDigestChars=${maxDigestChars}`,
      );

      const result = await this.aiBackService.request(requestInput, {
        type: 'acp_chat_relay_summary',
        requestId,
        sessionId: session.sessionId,
        messages,
        noTool: true,
        agentSessionConfig,
      });

      if (result.isCancel || result.errorCode !== 0 || !result.data) {
        this.warn(
          `[WebMCP][acp_chat][relay_summary] request done — requestId=${requestId}, success=false, isCancel=${Boolean(
            result.isCancel,
          )}, errorCode=${result.errorCode}, hasData=${Boolean(result.data)}, durationMs=${Date.now() - startedAt}`,
        );
        return '';
      }
      const digest = this.truncate(String(result.data), maxDigestChars);
      this.log(
        `[WebMCP][acp_chat][relay_summary] request done — requestId=${requestId}, success=true, resultChars=${
          String(result.data).length
        }, digestChars=${digest.length}, durationMs=${Date.now() - startedAt}`,
      );
      return digest;
    } catch (err) {
      this.warn(
        `[WebMCP][acp_chat][relay_summary] request error — requestId=${requestId}, errorName=${
          err instanceof Error ? err.name : typeof err
        }, durationMs=${Date.now() - startedAt}`,
      );
      return '';
    }
  }

  private formatMessagesForSummary(messages: Array<{ role: ChatMessageRole; content: string }>): string {
    return messages
      .map((message) => {
        const role = message.role === ChatMessageRole.User ? 'User' : 'Assistant';
        return `[${role}]\n${message.content}`;
      })
      .join('\n\n');
  }

  private buildMemoryDigest(session: AcpChatRelaySummarySession, maxDigestChars: number): string {
    const digest = session.history
      .getMemorySummaries()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((summary) => this.normalizeMemoryContent(summary.content))
      .filter(Boolean)
      .join('\n\n');
    return this.truncate(digest, maxDigestChars);
  }

  private normalizeMemoryContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed.memory === 'string') {
        return parsed.memory;
      }
      if (typeof parsed.content === 'string') {
        return parsed.content;
      }
    } catch {
      // Use raw memory text.
    }
    return content;
  }

  private getMemorySourceChars(session: AcpChatRelaySummarySession): number {
    return session.history.getMemorySummaries().reduce((total, summary) => total + summary.content.length, 0);
  }

  private getMemorySummaryCount(session: AcpChatRelaySummarySession): number {
    return session.history.getMemorySummaries().length;
  }

  private getHistoryMessageCount(session: AcpChatRelaySummarySession): number {
    return session.history.getMessages().length;
  }

  private buildBoundedSourceMaterial(
    session: AcpChatRelaySummarySession,
    maxSourceChars: number,
  ): BoundedSourceMaterial {
    let sourceChars = 0;
    let sourceTruncated = false;
    const messages: Array<{ role: ChatMessageRole; content: string }> = [];
    const sourceMessages = session.history
      .getMessages()
      .filter((message) => message.role === ChatMessageRole.User || message.role === ChatMessageRole.Assistant)
      .reverse();

    for (const message of sourceMessages) {
      if (!message.content) {
        continue;
      }
      const clippedContent = this.truncate(message.content, MAX_MESSAGE_CHARS);
      const nextSize = sourceChars + clippedContent.length;
      if (nextSize > maxSourceChars) {
        sourceTruncated = true;
        break;
      }
      sourceChars = nextSize;
      messages.push({ role: message.role, content: clippedContent });
      if (message.content.length > clippedContent.length) {
        sourceTruncated = true;
      }
    }

    return {
      messages: messages.reverse(),
      sourceChars,
      sourceTruncated,
    };
  }

  private emptyResult(source: BoundedSourceMaterial): AcpChatRelaySummaryResult {
    return {
      digestSource: 'empty',
      digest: '',
      digestChars: 0,
      sourceChars: source.sourceChars,
      sourceTruncated: source.sourceTruncated,
    };
  }

  private normalizeLimits(options: AcpChatRelaySummaryOptions): Required<AcpChatRelaySummaryOptions> {
    return {
      maxSourceChars: this.toPositiveCappedNumber(
        options.maxSourceChars,
        DEFAULT_MAX_SOURCE_CHARS,
        MAX_SOURCE_CHARS_CAP,
      ),
      maxDigestChars: this.toPositiveCappedNumber(
        options.maxDigestChars,
        DEFAULT_MAX_DIGEST_CHARS,
        MAX_DIGEST_CHARS_CAP,
      ),
    };
  }

  private toPositiveCappedNumber(value: unknown, fallback: number, cap: number): number {
    return Math.min(Math.max(Number(value) || fallback, 1), cap);
  }

  private truncate(value: string, maxChars: number): string {
    return value.length > maxChars ? value.slice(0, maxChars) : value;
  }

  private log(message: string): void {
    try {
      this.logger?.log?.(message);
    } catch {
      // Logger injection is optional for isolated unit tests.
    }
  }

  private warn(message: string): void {
    try {
      this.logger?.warn?.(message);
    } catch {
      // Logger injection is optional for isolated unit tests.
    }
  }
}
