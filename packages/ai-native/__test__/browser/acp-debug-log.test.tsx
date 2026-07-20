import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { AIBackSerivcePath, IClipboardService, URI } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import {
  ACP_DEBUG_LOG_SCHEME_ID,
  AcpDebugLogCommands,
  AcpDebugLogContribution,
} from '../../src/browser/acp/debug-log/acp-debug-log.contribution';
import { AcpDebugLogView } from '../../src/browser/acp/debug-log/acp-debug-log.view';

const useInjectable = jest.fn();

jest.mock('@opensumi/ide-core-browser', () => ({
  useInjectable: (...args: unknown[]) => useInjectable(...args),
}));

jest.mock('@opensumi/ide-editor/lib/browser/types', () => ({
  BrowserEditorContribution: Symbol('BrowserEditorContribution'),
  EditorComponentRenderMode: {
    ONE_PER_WORKBENCH: 'ONE_PER_WORKBENCH',
  },
  ResourceService: Symbol('ResourceService'),
  WorkbenchEditorService: Symbol('WorkbenchEditorService'),
}));

jest.mock('../../src/browser/acp/debug-log/acp-debug-log.module.less', () => ({
  actions: 'actions',
  container: 'container',
  description: 'description',
  empty: 'empty',
  header: 'header',
  log: 'log',
  title: 'title',
}));

describe('AcpDebugLogContribution', () => {
  it('registers a command that opens the ACP debug log editor', () => {
    const contribution = new AcpDebugLogContribution();
    const open = jest.fn();
    Object.defineProperty(contribution, 'editorService', {
      configurable: true,
      value: { open },
    });

    let handler: { execute: () => void } | undefined;
    const registry = {
      registerCommand: jest.fn((_command, commandHandler) => {
        handler = commandHandler;
      }),
    };

    contribution.registerCommands(registry as any);
    handler!.execute();

    expect(registry.registerCommand).toHaveBeenCalledWith(AcpDebugLogCommands.OPEN_ACP_DEBUG_LOG, expect.any(Object));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ scheme: ACP_DEBUG_LOG_SCHEME_ID }), {
      focus: true,
      preview: false,
    });
  });

  it('registers the readonly editor component resource', async () => {
    const contribution = new AcpDebugLogContribution();
    const editorRegistry = {
      registerEditorComponent: jest.fn(),
      registerEditorComponentResolver: jest.fn(),
    };
    const resourceService = {
      registerResourceProvider: jest.fn(),
    };

    contribution.registerEditorComponent(editorRegistry as any);
    contribution.registerResource(resourceService as any);

    expect(editorRegistry.registerEditorComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        component: AcpDebugLogView,
        scheme: ACP_DEBUG_LOG_SCHEME_ID,
      }),
    );
    const provider = resourceService.registerResourceProvider.mock.calls[0][0];
    const resource = await provider.provideResource(new URI().withScheme(ACP_DEBUG_LOG_SCHEME_ID));
    expect(resource.name).toBe('ACP Debug Log');
  });
});

describe('AcpDebugLogView', () => {
  let container: HTMLDivElement;
  let root: Root;
  let aiBackService: {
    clearAcpDebugLog: jest.Mock<Promise<void>>;
    getAcpDebugLog: jest.Mock<Promise<any[]>>;
  };
  let clipboardService: { writeText: jest.Mock<Promise<void>> };
  let messageService: { error: jest.Mock<void> };

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    aiBackService = {
      clearAcpDebugLog: jest.fn(async () => undefined),
      getAcpDebugLog: jest.fn(async () => [
        {
          agentId: 'codex',
          direction: 'incoming',
          id: 1,
          payload: { jsonrpc: '2.0' },
          raw: '{"jsonrpc":"2.0"}',
          sessionId: 'session-1',
          threadId: 'thread-1',
          timestamp: 1710000000000,
        },
      ]),
    };
    clipboardService = { writeText: jest.fn(async () => undefined) };
    messageService = { error: jest.fn() };
    useInjectable.mockImplementation((token) => {
      if (token === AIBackSerivcePath) {
        return aiBackService;
      }
      if (token === IClipboardService) {
        return clipboardService;
      }
      if (token === IMessageService) {
        return messageService;
      }
      return undefined;
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('loads, copies, clears, and renders an empty state', async () => {
    await act(async () => {
      root.render(<AcpDebugLogView />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('ACP Debug Log');
    expect(container.textContent).toContain('agent=codex');
    expect(container.textContent).toContain('{"jsonrpc":"2.0"}');

    const buttons = Array.from(container.querySelectorAll('button'));
    await act(async () => {
      buttons.find((button) => button.textContent === 'Copy All')!.click();
      await Promise.resolve();
    });
    expect(clipboardService.writeText).toHaveBeenCalledWith(expect.stringContaining('thread=thread-1'));

    await act(async () => {
      buttons.find((button) => button.textContent === 'Clear')!.click();
      await Promise.resolve();
    });
    expect(aiBackService.clearAcpDebugLog).toHaveBeenCalled();
    expect(container.textContent).toContain('No ACP debug log entries yet.');
  });

  it('refreshes logs on demand', async () => {
    await act(async () => {
      root.render(<AcpDebugLogView />);
      await Promise.resolve();
    });
    aiBackService.getAcpDebugLog.mockResolvedValueOnce([]);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Refresh')!
        .click();
      await Promise.resolve();
    });

    expect(aiBackService.getAcpDebugLog).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('No ACP debug log entries yet.');
  });

  it('redacts sensitive protocol fields and MCP credentials when rendering and copying', async () => {
    const mcpToken = '0123456789abcdef0123456789abcdef';
    const apiKey = 'sk-super-secret-value';
    aiBackService.getAcpDebugLog.mockResolvedValueOnce([
      {
        agentId: 'codex',
        direction: 'incoming',
        id: 2,
        payload: {
          method: 'session/update',
          params: {
            prompt: 'BDD_SECRET_PROMPT',
            update: {
              content: 'BDD_SECRET_ASSISTANT',
              rawInput: { apiKey },
              rawOutput: 'BDD_SECRET_TOOL_RESULT',
              url: `http://127.0.0.1:1234/mcp/${mcpToken}`,
            },
          },
        },
        raw: JSON.stringify({
          method: 'session/request_permission',
          params: { prompt: 'BDD_SECRET_PERMISSION', token: apiKey },
        }),
        sessionId: 'session-2',
        threadId: 'thread-2',
        timestamp: 1710000000000,
      },
    ]);

    await act(async () => {
      root.render(<AcpDebugLogView />);
      await Promise.resolve();
    });

    const rendered = container.textContent || '';
    expect(rendered).toContain('<redacted>');
    expect(rendered).not.toContain(mcpToken);
    expect(rendered).not.toContain(apiKey);
    expect(rendered).not.toContain('BDD_SECRET_PROMPT');
    expect(rendered).not.toContain('BDD_SECRET_ASSISTANT');
    expect(rendered).not.toContain('BDD_SECRET_TOOL_RESULT');
    expect(rendered).not.toContain('BDD_SECRET_PERMISSION');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Copy All')!
        .click();
      await Promise.resolve();
    });

    const copiedCalls = clipboardService.writeText.mock.calls;
    const copied = copiedCalls[copiedCalls.length - 1]?.[0] || '';
    expect(copied).toContain('/mcp/<redacted>');
    expect(copied).not.toContain(mcpToken);
    expect(copied).not.toContain(apiKey);
    expect(copied).not.toContain('BDD_SECRET_PROMPT');
    expect(copied).not.toContain('BDD_SECRET_ASSISTANT');
    expect(copied).not.toContain('BDD_SECRET_TOOL_RESULT');
    expect(copied).not.toContain('BDD_SECRET_PERMISSION');
  });
});
