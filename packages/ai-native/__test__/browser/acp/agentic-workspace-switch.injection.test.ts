import { Injector } from '@opensumi/di';

import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';
import { AcpChatInternalService } from '../../../src/browser/chat/chat.internal.service.acp';
import { IChatInternalService } from '../../../src/common';

describe('AgenticWorkspaceSwitchService injection', () => {
  it('uses the chat service exposed to the active chat view for task drafts', () => {
    const activeChatService = { enterAgenticTaskDraft: jest.fn() };
    const detachedAcpChatService = { enterAgenticTaskDraft: jest.fn() };
    const injector = new Injector([
      AgenticWorkspaceSwitchService,
      { token: IChatInternalService, useValue: activeChatService },
      { token: AcpChatInternalService, useValue: detachedAcpChatService },
    ]);

    const switcher = injector.get(AgenticWorkspaceSwitchService) as any;

    expect(switcher.aiChatService).toBe(activeChatService);
  });
});
