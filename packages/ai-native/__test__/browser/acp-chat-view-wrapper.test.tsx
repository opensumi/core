import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  AINativeConfigService: Symbol('AINativeConfigService'),
  useInjectable: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/progress/progress-bar', () => ({
  Progress: () => require('react').createElement('div', { 'data-testid': 'progress' }),
}));

jest.mock('@opensumi/ide-core-common', () => ({
  AIBackSerivcePath: Symbol('AIBackSerivcePath'),
  localize: (_key: string, defaultValue?: string) => defaultValue || _key,
}));

jest.mock('../../src/common', () => ({
  ChatProxyServiceToken: Symbol('ChatProxyServiceToken'),
  IChatManagerService: Symbol('IChatManagerService'),
}));

jest.mock('../../src/browser/chat/chat-manager.service.acp', () => ({
  AcpChatManagerService: class AcpChatManagerService {},
}));

jest.mock('../../src/browser/chat/chat-proxy.service.acp', () => ({
  AcpChatProxyService: class AcpChatProxyService {},
}));

jest.mock('../../src/browser/chat/chat.internal.service', () => ({
  ChatInternalService: class ChatInternalService {},
}));

import { AcpChatViewWrapper } from '../../src/browser/acp/components/AcpChatViewWrapper';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function createServices({
  createSessionModel = jest.fn(() => Promise.resolve()),
  ready = jest.fn(() => Promise.resolve(true)),
  sessionModel,
  supportsAgentMode = true,
}: {
  createSessionModel?: jest.Mock;
  ready?: jest.Mock;
  sessionModel?: unknown;
  supportsAgentMode?: boolean;
} = {}) {
  const aiBackService = {
    ready,
  };
  const aiChatService = {
    init: jest.fn(),
    createSessionModel,
    sessionModel,
  };
  const chatManagerService = {
    fallbackToLocal: jest.fn(),
    loadSessionList: jest.fn(() => Promise.resolve()),
  };
  const chatProxyService = {
    registerFallbackAgent: jest.fn(),
  };

  jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: any) => {
    const key = String(token);
    const name = token?.name || '';

    if (key.includes('AINativeConfigService')) {
      return { capabilities: { supportsAgentMode } };
    }

    if (key.includes('AIBackSerivcePath')) {
      return aiBackService;
    }

    if (key.includes('IChatManagerService') || name === 'AcpChatManagerService') {
      return chatManagerService;
    }

    if (key.includes('ChatProxyServiceToken') || name === 'AcpChatProxyService') {
      return chatProxyService;
    }

    return {};
  });

  return {
    aiBackService,
    aiChatService,
    chatManagerService,
    chatProxyService,
  };
}

describe('AcpChatViewWrapper', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  async function renderWrapper(aiChatService: any) {
    await act(async () => {
      root.render(
        React.createElement(
          AcpChatViewWrapper,
          { aiChatService },
          React.createElement('div', { 'data-testid': 'child' }, 'child'),
        ),
      );
    });
    await act(async () => {
      await flushPromises();
    });
  }

  it('creates an ACP session before rendering children so config options can populate', async () => {
    const services = createServices();

    await renderWrapper(services.aiChatService);

    expect(services.aiBackService.ready).toHaveBeenCalled();
    expect(services.aiChatService.init).toHaveBeenCalledTimes(1);
    expect(services.aiChatService.createSessionModel).toHaveBeenCalledTimes(1);
    expect(services.chatManagerService.loadSessionList).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it('does not create another ACP session when one is already active', async () => {
    const services = createServices({
      sessionModel: { sessionId: 'acp:existing-session' },
    });

    await renderWrapper(services.aiChatService);

    expect(services.aiBackService.ready).toHaveBeenCalled();
    expect(services.aiChatService.init).toHaveBeenCalledTimes(1);
    expect(services.aiChatService.createSessionModel).not.toHaveBeenCalled();
    expect(services.chatManagerService.loadSessionList).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it('falls back and creates a local session when ACP backend is unavailable', async () => {
    const services = createServices({
      ready: jest.fn(() => Promise.reject(new Error('not ready'))),
    });

    await renderWrapper(services.aiChatService);

    expect(services.chatManagerService.fallbackToLocal).toHaveBeenCalledTimes(1);
    expect(services.chatProxyService.registerFallbackAgent).toHaveBeenCalledTimes(1);
    expect(services.aiChatService.createSessionModel).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});
