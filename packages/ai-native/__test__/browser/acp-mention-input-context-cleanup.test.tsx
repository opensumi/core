import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { URI } from '@opensumi/ide-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  getSymbolIcon: jest.fn(() => 'symbol-icon'),
  localize: (key: string) => key,
  useInjectable: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className, iconClass, onClick }: { className?: string; iconClass?: string; onClick?: () => void }) =>
    require('react').createElement('span', { className: className || iconClass, onClick }),
  Popover: ({ children }: { children: React.ReactNode }) => require('react').createElement('div', null, children),
  PopoverPosition: {
    top: 'top',
  },
  getIcon: (name: string) => `icon-${name}`,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({
    ariaLabel,
    className,
    onClick,
    role,
    tabIndex,
    wrapperClassName,
  }: {
    ariaLabel?: string;
    className?: string;
    onClick?: () => void;
    role?: string;
    tabIndex?: number;
    wrapperClassName?: string;
  }) =>
    require('react').createElement(
      'button',
      {
        'aria-label': ariaLabel,
        className: [wrapperClassName, className].filter(Boolean).join(' '),
        onClick,
        role,
        tabIndex,
        type: 'button',
      },
      ariaLabel,
    ),
}));

jest.mock('../../src/browser/acp/permission-dialog-container', () => ({
  PermissionDialogManager: Symbol('PermissionDialogManager'),
}));

jest.mock('../../src/browser/components/permission-dialog-widget', () => ({
  PermissionDialogWidget: () => null,
}));

jest.mock('../../src/browser/chat/chat-input-footer.registry', () => ({
  ChatInputFooterRegistry: jest.fn(),
  ChatInputFooterRegistryToken: Symbol('ChatInputFooterRegistryToken'),
}));

jest.mock('../../src/browser/components/mention-input/mention-panel', () => ({
  MentionPanel: () => require('react').createElement('div'),
}));

jest.mock('../../src/browser/components/mention-input/mention-select', () => ({
  MentionSelect: () => require('react').createElement('select'),
}));

import { MentionInput } from '../../src/browser/components/acp/MentionInput';

function createContextService() {
  const listeners: Array<(event: any) => void> = [];
  const contextService = {
    addFileToContext: jest.fn(),
    addFolderToContext: jest.fn(),
    addRuleToContext: jest.fn(),
    cleanFileContext: jest.fn(() => {
      listeners.forEach((listener) =>
        listener({
          attached: [],
          attachedFolders: [],
          attachedRules: [],
          viewed: [],
          version: 2,
        }),
      );
    }),
    onDidContextFilesChangeEvent: jest.fn((listener: (event: any) => void) => {
      listeners.push(listener);
      return { dispose: jest.fn() };
    }),
    removeFileFromContext: jest.fn(),
    removeFolderFromContext: jest.fn(),
    removeRuleFromContext: jest.fn(),
    serialize: jest.fn(),
  };

  return {
    contextService,
    emitAttachedFile: (uri: URI) => {
      listeners.forEach((listener) =>
        listener({
          attached: [{ uri }],
          attachedFolders: [],
          attachedRules: [],
          viewed: [],
          version: 1,
        }),
      );
    },
  };
}

describe('ACP MentionInput context cleanup', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue({
      getItems: jest.fn(() => []),
      onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it('clears footer context preview state after a context-chip send settles', async () => {
    let resolveSend!: () => void;
    const sendResult = new Promise<void>((resolve) => {
      resolveSend = resolve;
    });
    const onSend = jest.fn(() => sendResult);
    const fileUri = URI.file('/workspace/editor.js');
    const { contextService, emitAttachedFile } = createContextService();

    act(() => {
      root.render(
        React.createElement(MentionInput, {
          contextService,
          footerConfig: { buttons: [], showModelSelector: false },
          labelService: { getIcon: jest.fn(() => 'file-icon') },
          onSend,
          workspaceService: { workspace: { uri: URI.file('/workspace').toString() } },
        } as any),
      );
    });

    act(() => {
      emitAttachedFile(fileUri);
    });

    expect(container.querySelector('.context_preview_item[data-type="file"]')?.textContent).toContain('editor.js');

    const editor = container.querySelector('.editor') as HTMLDivElement;
    editor.innerHTML = `<span class="mention_tag" data-id="editor.js" data-type="file" data-context-id="${fileUri.toString()}" contenteditable="false">editor.js</span>&nbsp;BDD context attachment chip send`;

    act(() => {
      (container.querySelector('button[aria-label="Send"]') as HTMLButtonElement).click();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(editor.innerHTML).toContain('BDD context attachment chip send');
    expect(contextService.cleanFileContext).not.toHaveBeenCalled();
    expect(container.querySelector('.context_preview_item[data-type="file"]')?.textContent).toContain('editor.js');

    await act(async () => {
      resolveSend();
      await sendResult;
      await Promise.resolve();
    });

    expect(editor.innerHTML).toBe('');
    expect(contextService.cleanFileContext).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.context_preview_item[data-type="file"]')).toBeNull();
  });
});
