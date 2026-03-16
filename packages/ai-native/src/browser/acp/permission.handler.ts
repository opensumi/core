import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences';
import { Disposable, ILogger, IStorage, STORAGE_NAMESPACE, StorageProvider, uuid } from '@opensumi/ide-core-common';

import type {
  PermissionOption,
  PermissionOptionKind,
  RequestPermissionResponse,
  ToolCallUpdate,
} from '../../common/acp-types';

export interface PermissionRequest {
  sessionId: string;
  toolCall: ToolCallUpdate;
  options: PermissionOption[];
  timeout?: number;
}

export type PermissionDecision =
  | { type: 'allow'; optionId: string; always: boolean }
  | { type: 'reject'; optionId: string; always: boolean }
  | { type: 'timeout' }
  | { type: 'cancelled' };

interface PermissionRule {
  id: string;
  pattern: string;
  kind: ToolKind;
  decision: 'allow' | 'reject';
  always: boolean;
  createdAt: number;
}

type ToolKind = 'read' | 'write' | 'edit' | 'command' | 'search';

@Injectable()
export class AcpPermissionHandler extends Disposable {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  private pendingRequests = new Map<
    string,
    {
      resolve: (decision: PermissionDecision) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  private rules: PermissionRule[] = [];
  private defaultTimeout = 60000; // 60 seconds

  private permissionStorage: IStorage;

  constructor() {
    super();
    this.initStorage();
  }

  private async initStorage(): Promise<void> {
    this.permissionStorage = await this.storageProvider(STORAGE_NAMESPACE.AI_NATIVE);
    this.loadRules();
  }

  /**
   * Request permission for a tool operation
   */
  async requestPermission(request: PermissionRequest): Promise<PermissionDecision> {
    const requestId = uuid();

    // Check existing rules first
    const autoDecision = this.checkRules(request);
    if (autoDecision) {
      this.logger.log(`Auto-${autoDecision.type}ed permission based on rule for ${request.toolCall.title}`);
      return autoDecision;
    }

    return new Promise((resolve) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.logger.warn(`Permission request timed out: ${request.toolCall.title}`);
        resolve({ type: 'timeout' });
      }, request.timeout ?? this.defaultTimeout);

      this.pendingRequests.set(requestId, {
        resolve,
        timeout,
      });

      // Show permission dialog
      this.showPermissionDialog(requestId, request);
    });
  }

  /**
   * Handle user response to permission request
   */
  handleUserResponse(requestId: string, optionId: string, optionKind: PermissionOptionKind): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      this.logger.warn(`Permission request ${requestId} not found (maybe timed out)`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    const always = optionKind === 'allow_always' || optionKind === 'reject_always';
    const allow = optionKind === 'allow_once' || optionKind === 'allow_always';

    // Save rule if "always"
    if (always) {
      this.addRule(requestId, optionId, allow ? 'allow' : 'reject');
    }

    if (allow) {
      pending.resolve({
        type: 'allow',
        optionId,
        always,
      });
    } else {
      pending.resolve({
        type: 'reject',
        optionId,
        always,
      });
    }
  }

  /**
   * Cancel a pending permission request
   */
  cancelRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.resolve({ type: 'cancelled' });
  }

  /**
   * Build permission response for the agent
   */
  buildPermissionResponse(decision: PermissionDecision): RequestPermissionResponse {
    switch (decision.type) {
      case 'allow':
        return {
          outcome: {
            outcome: 'selected',
            optionId: decision.optionId,
          },
        };
      case 'reject':
        return {
          outcome: {
            outcome: 'selected',
            optionId: decision.optionId,
          },
        };
      case 'timeout':
      case 'cancelled':
        return {
          outcome: {
            outcome: 'cancelled',
          },
        };
    }
  }

  /**
   * Get all saved permission rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * Remove a permission rule
   */
  removeRule(ruleId: string): void {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.saveRules();
    }
  }

  /**
   * Clear all permission rules
   */
  clearRules(): void {
    this.rules = [];
    this.saveRules();
  }

  private showPermissionDialog(requestId: string, request: PermissionRequest): void {
    // This will be implemented to show a UI dialog
    // For now, log the request
    this.logger.log(`Permission request [${requestId}]: ${request.toolCall.title}`);
    this.logger.log(`  Kind: ${request.toolCall.kind}`);
    this.logger.log(`  Options: ${request.options.map((o) => o.name).join(', ')}`);

    // TODO: Implement actual dialog UI component
    // - Show tool call details
    // - Show affected files/directories
    // - Show command preview for terminal operations
    // - Provide Allow/Allow Always/Reject/Reject Always buttons
    // - Show countdown timer
  }

  private checkRules(request: PermissionRequest): PermissionDecision | null {
    const toolKind = request.toolCall.kind || 'read';

    // Build pattern from tool call
    let pattern = '';
    if (request.toolCall.locations && request.toolCall.locations.length > 0) {
      pattern = request.toolCall.locations.map((l) => l.path).join(',');
    } else {
      pattern = request.toolCall.title || '';
    }

    for (const rule of this.rules) {
      // Check if kind matches
      if (rule.kind !== toolKind) {
        continue;
      }

      // Check if pattern matches (exact or glob)
      if (this.matchPattern(pattern, rule.pattern)) {
        return {
          type: rule.decision,
          optionId: rule.decision === 'allow' ? 'allow_always' : 'reject_always',
          always: true,
        };
      }
    }

    return null;
  }

  private matchPattern(value: string, pattern: string): boolean {
    // Simple glob matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return regex.test(value);
    }
    return value === pattern || value.startsWith(pattern);
  }

  private addRule(requestId: string, pattern: string, decision: 'allow' | 'reject'): void {
    // Extract pattern from request
    // This is a placeholder - actual implementation should extract from the request
    const rule: PermissionRule = {
      id: uuid(),
      pattern,
      kind: 'write', // Should be extracted from actual request
      decision,
      always: true,
      createdAt: Date.now(),
    };

    // Remove conflicting rules
    this.rules = this.rules.filter((r) => r.pattern !== pattern || r.kind !== rule.kind);

    this.rules.push(rule);
    this.saveRules();

    this.logger.log(`Permission rule added: ${pattern} => ${decision}`);
  }

  private loadRules(): void {
    try {
      const saved = this.permissionStorage.get<string>('acp.permission.rules', '[]');
      if (saved && saved !== '[]') {
        this.rules = JSON.parse(saved);
        this.logger.log(`Loaded ${this.rules.length} permission rules`);
      }
    } catch (e) {
      this.logger.error('Failed to load permission rules:', e);
      this.rules = [];
    }
  }

  private saveRules(): void {
    try {
      this.permissionStorage.set('acp.permission.rules', JSON.stringify(this.rules));
    } catch (e) {
      this.logger.error('Failed to save permission rules:', e);
    }
  }

  /**
   * Log permission audit event
   */
  auditLog(
    event: 'request' | 'decision',
    data: {
      requestId: string;
      sessionId: string;
      toolKind?: ToolKind;
      toolTitle?: string;
      decision?: string;
      reason?: string;
    },
  ): void {
    const timestamp = new Date().toISOString();

    // Log to console (could be extended to server-side logging)
    this.logger.log(`[ACP Permission Audit ${timestamp}] ${event}:`, {
      requestId: data.requestId,
      sessionId: data.sessionId,
      toolKind: data.toolKind,
      toolTitle: data.toolTitle,
      decision: data.decision,
      reason: data.reason,
    });

    // TODO: Send audit logs to server
  }
}
