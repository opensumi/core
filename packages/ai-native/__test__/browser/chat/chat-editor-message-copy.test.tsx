import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('react-highlight', () => () => require('react').createElement('pre', null, null));

jest.mock('lodash/capitalize', () => (value: string) => value);

jest.mock('@opensumi/ide-components/lib/image', () => ({
  Image: () => null,
}));

jest.mock('@opensumi/ide-core-browser', () => ({
  EDITOR_COMMANDS: { OPEN_RESOURCE: { id: 'editor.openResource' } },
  FILE_COMMANDS: { REVEAL_IN_EXPLORER: { id: 'file.revealInExplorer' } },
  IClipboardService: Symbol('IClipboardService'),
  LabelService: Symbol('LabelService'),
  getIcon: (name: string) => `icon-${name}`,
  useInjectable: jest.fn(),
  uuid: (size?: number) => `uuid-${size || 6}`,
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className }: { className?: string }) => require('react').createElement('span', { 'data-icon': className }),
  Popover: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(React.Fragment, null, children),
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({ onClick, ariaLabel, className }: any) =>
    require('react').createElement('div', {
      onClick,
      'aria-label': ariaLabel,
      className,
      role: 'button',
      tabIndex: 0,
    }),
}));

jest.mock('@opensumi/ide-core-common', () => ({
  ActionSourceEnum: { Chat: 'Chat' },
  ActionTypeEnum: { ChatCopyCode: 'chat_copy_code', ChatInsertCode: 'chat_insert_code' },
  ChatFeatureRegistryToken: Symbol('ChatFeatureRegistryToken'),
  CommandService: Symbol('CommandService'),
  IAIReporter: Symbol('IAIReporter'),
  URI: class URI {
    constructor(public readonly uri: string) {}
  },
  localize: (key: string) => key,
  runWhenIdle: (callback: () => void) => {
    callback();
    return { dispose: () => undefined };
  },
}));

jest.mock('@opensumi/ide-editor/lib/browser/base-editor-wrapper', () => ({
  insertSnippetWithMonacoEditor: jest.fn(),
}));

jest.mock('@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service', () => ({
  MonacoCommandRegistry: class MonacoCommandRegistry {},
}));

jest.mock('@opensumi/ide-theme', () => ({
  IThemeService: Symbol('IThemeService'),
}));

jest.mock('@opensumi/ide-theme/lib/browser/workbench.theme.service', () => ({
  WorkbenchThemeService: class WorkbenchThemeService {},
}));

jest.mock('../../../src/browser/chat/chat.feature.registry', () => ({
  ChatFeatureRegistry: class ChatFeatureRegistry {},
}));

import { CodeBlockWrapperInput } from '../../../src/browser/components/ChatEditor';

describe('CodeBlockWrapperInput message copy', () => {
  let container: HTMLDivElement;
  let root: Root;
  let writeText: jest.Mock;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    writeText = jest.fn().mockResolvedValue(undefined);

    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: any) => {
      const key = String(token);

      if (key.includes('IClipboardService')) {
        return { writeText };
      }

      if (key.includes('ChatFeatureRegistryToken')) {
        return {
          parseSlashCommand: (text: string) => {
            const match = text.match(/^(\/[^\s]+)\s*([\s\S]*)$/);
            if (match) {
              return { nameWithSlash: match[1], value: match[2] };
            }
            return { value: text };
          },
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

  function renderInput(text: string) {
    act(() => {
      root.render(<CodeBlockWrapperInput relationId='relation-1' text={text} />);
    });
  }

  function getCopyButton() {
    const button = Array.from(container.querySelectorAll('[role="button"]')).find((item) =>
      item.getAttribute('aria-label')?.includes('aiNative.chat.message.copy'),
    );
    expect(button).not.toBeUndefined();
    return button as HTMLDivElement;
  }

  it('renders a copy action for user messages', () => {
    renderInput('hello agent');

    expect(getCopyButton()).not.toBeUndefined();
  });

  it('writes the raw user message to the clipboard on click', async () => {
    renderInput('hello agent');

    await act(async () => {
      getCopyButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('hello agent');
  });

  it('copies the original message including slash commands', async () => {
    renderInput('/fix please fix this bug');

    await act(async () => {
      getCopyButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('/fix please fix this bug');
  });
});
