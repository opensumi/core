import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-components/lib/button', () => ({
  Button: ({ children, onClick }: any) =>
    require('react').createElement(
      'button',
      {
        onClick,
        type: 'button',
      },
      children,
    ),
}));

jest.mock('@opensumi/ide-components/lib/recycle-tree', () => ({
  BasicRecycleTree: () => null,
}));

jest.mock('@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define', () => ({
  BasicCompositeTreeNode: {
    is: jest.fn(() => false),
  },
  BasicTreeNode: {},
}));

jest.mock('@opensumi/ide-components/lib/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(React.Fragment, null, children),
}));

jest.mock('@opensumi/ide-core-browser', () => {
  class DisposableCollection {
    private disposables: Array<{ dispose?: () => void }> = [];

    push(disposable: { dispose?: () => void }) {
      this.disposables.push(disposable);
      return disposable;
    }

    dispose() {
      this.disposables.forEach((disposable) => disposable.dispose?.());
    }
  }

  return {
    CommandService: Symbol('CommandService'),
    DisposableCollection,
    EDITOR_COMMANDS: {
      OPEN_RESOURCE: {
        id: 'editor.openResource',
      },
    },
    IContextKeyService: Symbol('IContextKeyService'),
    LabelService: Symbol('LabelService'),
    useInjectable: jest.fn(),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className, iconClass }: { className?: string; iconClass?: string }) =>
    require('react').createElement('span', { 'data-icon': iconClass || className }),
  getIcon: (name: string) => `icon-${name}`,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  Loading: () => require('react').createElement('span', null, 'loading'),
}));

jest.mock('@opensumi/ide-core-common', () => ({
  ActionSourceEnum: {
    Chat: 'Chat',
  },
  ActionTypeEnum: {
    Followup: 'Followup',
  },
  ChatAgentViewServiceToken: Symbol('ChatAgentViewServiceToken'),
  ChatRenderRegistryToken: Symbol('ChatRenderRegistryToken'),
  ChatServiceToken: Symbol('ChatServiceToken'),
  FileType: {
    Directory: 2,
  },
  IAIReporter: Symbol('IAIReporter'),
  URI: class URI {
    constructor(public readonly uri: string) {}
  },
  localize: (key: string) => (key === 'aiNative.chat.thinking' ? 'Deep Thinking' : key),
}));

jest.mock('@opensumi/ide-theme', () => ({
  IIconService: Symbol('IIconService'),
}));

jest.mock('@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent', () => ({
  MarkdownString: class MarkdownString {
    constructor(public readonly value: string) {}
  },
}));

jest.mock('../../../src/common', () => ({
  IChatAgentService: Symbol('IChatAgentService'),
  IChatInternalService: Symbol('IChatInternalService'),
}));

jest.mock('../../../src/browser/chat/chat-model', () => ({
  ChatRequestModel: class ChatRequestModel {},
}));

jest.mock('../../../src/browser/chat/chat.api.service', () => ({
  ChatService: class ChatService {},
}));

jest.mock('../../../src/browser/chat/chat.internal.service', () => ({
  ChatInternalService: class ChatInternalService {},
}));

jest.mock('../../../src/browser/chat/chat.render.registry', () => ({
  ChatRenderRegistry: class ChatRenderRegistry {},
}));

jest.mock('../../../src/browser/model/msg-history-manager', () => ({
  MsgHistoryManager: class MsgHistoryManager {},
}));

jest.mock('../../../src/browser/components/ChatMarkdown', () => ({
  ChatMarkdown: ({ markdown }: any) =>
    require('react').createElement('div', { 'data-testid': 'chat-markdown' }, markdown.value),
}));

jest.mock('../../../src/browser/components/ChatThinking', () => ({
  ChatThinking: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement('div', { 'data-testid': 'chat-thinking' }, children),
  ChatThinkingResult: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement('div', { 'data-testid': 'chat-thinking-result' }, children),
}));

import { ChatReply } from '../../../src/browser/components/ChatReply';

interface ReasoningContent {
  kind: 'reasoning';
  content: string;
}

let requestIdPool = 0;

function createRequest(responseContents: ReasoningContent[], isComplete: boolean) {
  const requestId = `request-${requestIdPool++}`;
  const listeners = new Set<() => void>();
  const response = {
    errorDetails: undefined,
    followups: undefined,
    isComplete,
    onDidChange: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return {
        dispose: () => listeners.delete(listener),
      };
    }),
    reset: jest.fn(),
    responseContents,
    responseParts: responseContents,
    responseText: '',
  };

  return {
    emitChange: () => listeners.forEach((listener) => listener()),
    request: {
      requestId,
      response,
    },
    response,
  };
}

describe('ChatReply reasoning collapse state', () => {
  let container: HTMLDivElement;
  let root: Root;
  let history: { updateAssistantMessage: jest.Mock };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    history = {
      updateAssistantMessage: jest.fn(),
    };

    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: any) => {
      const key = String(token);

      if (key.includes('IAIReporter')) {
        return {
          end: jest.fn(),
        };
      }

      if (key.includes('IIconService')) {
        return {
          fromString: (icon: string) => icon,
        };
      }

      if (key.includes('IChatInternalService')) {
        return {
          sessionModel: {
            sessionId: 'session-1',
          },
        };
      }

      if (key.includes('ChatServiceToken')) {
        return {
          sendMessage: jest.fn(),
        };
      }

      if (key.includes('IChatAgentService')) {
        return {
          parseMessage: (message: string) => ({ message }),
        };
      }

      if (key.includes('ChatRenderRegistryToken')) {
        return {};
      }

      if (key.includes('IContextKeyService')) {
        return {
          match: jest.fn(() => true),
        };
      }

      if (key.includes('ChatAgentViewServiceToken')) {
        return {
          getChatComponent: jest.fn(() => undefined),
          getChatComponentDeferred: jest.fn(),
        };
      }

      return {};
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  function renderReply(request: any, collapseReasoningByDefault = false) {
    act(() => {
      root.render(
        <ChatReply
          collapseReasoningByDefault={collapseReasoningByDefault}
          history={history as any}
          msgId='message-1'
          relationId='relation-1'
          request={request}
        />,
      );
    });
  }

  function getThinkingButton() {
    const button = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Deep Thinking'),
    );
    expect(button).not.toBeUndefined();
    return button as HTMLButtonElement;
  }

  it('collapses completed reasoning by default when requested and expands on click', () => {
    const { request } = createRequest([{ kind: 'reasoning', content: 'completed thought' }], true);

    renderReply(request, true);

    expect(container.textContent).toContain('Deep Thinking');
    expect(container.textContent).not.toContain('completed thought');

    act(() => {
      getThinkingButton().click();
    });

    expect(container.textContent).toContain('completed thought');
  });

  it('collapses streaming reasoning by default and keeps it expanded after stream updates', async () => {
    const { emitChange, request, response } = createRequest([{ kind: 'reasoning', content: 'stream thought' }], false);

    renderReply(request, true);

    expect(container.textContent).toContain('Deep Thinking');
    expect(container.textContent).not.toContain('stream thought');

    act(() => {
      getThinkingButton().click();
    });

    expect(container.textContent).toContain('stream thought');

    response.responseContents = [{ kind: 'reasoning', content: 'stream thought updated' }];
    response.responseParts = response.responseContents;

    await act(async () => {
      emitChange();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('stream thought updated');

    response.isComplete = true;

    await act(async () => {
      emitChange();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('stream thought updated');

    act(() => {
      root.render(<React.Fragment />);
    });

    renderReply(request, true);

    expect(container.textContent).toContain('stream thought updated');
  });

  it('keeps streaming reasoning expanded by default for normal chat replies', () => {
    const { request } = createRequest([{ kind: 'reasoning', content: 'normal stream thought' }], false);

    renderReply(request);

    expect(container.textContent).toContain('Deep Thinking');
    expect(container.textContent).toContain('normal stream thought');
  });
});
