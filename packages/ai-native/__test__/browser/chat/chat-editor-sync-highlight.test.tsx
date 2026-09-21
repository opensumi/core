import hljs from 'highlight.js';
import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

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

import { CodeEditorWithHighlight } from '../../../src/browser/components/ChatEditor';

/**
 * Regression: restoring a long ACP session mounts hundreds of tool-argument /
 * tool-result / code blocks. Each CodeEditorWithHighlight used to run
 * highlight.js auto-detection over the full content synchronously on the main
 * thread (react-highlight 0.15 never sets a language- class), freezing the UI
 * for tens of seconds. These tests pin the two load-bearing properties:
 *   1. oversized content never reaches highlight.js;
 *   2. sized content is highlighted with an explicit language (no auto-detect).
 */
describe('CodeEditorWithHighlight synchronous highlight bounds', () => {
  let container: HTMLDivElement;
  let root: Root;
  let highlightAutoSpy: jest.SpyInstance;
  let highlightBlockSpy: jest.SpyInstance;

  const LARGE_TOOL_ARGS = JSON.stringify(
    {
      path: '/src/generated/module.ts',
      content: Array.from(
        { length: 3000 },
        (_, i) => `export const value${i} = compute(${i}); // some padding text`,
      ).join('\n'),
    },
    null,
    2,
  );

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Element.prototype.scrollIntoView = jest.fn();

    highlightAutoSpy = jest.spyOn(hljs, 'highlightAuto');
    highlightBlockSpy = jest.spyOn(hljs, 'highlightBlock');

    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation((token: any) => {
      const key = String(token);
      if (key.includes('IClipboardService')) {
        return { writeText: jest.fn().mockResolvedValue(undefined) };
      }
      if (key.includes('IThemeService')) {
        return {
          onThemeChange: () => ({ dispose: () => undefined }),
          getCurrentThemeSync: () => ({ type: 'light' }),
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
    highlightAutoSpy.mockRestore();
    highlightBlockSpy.mockRestore();
    jest.clearAllMocks();
  });

  function renderEditor(input: string, language?: string) {
    act(() => {
      root.render(<CodeEditorWithHighlight input={input} language={language} relationId='relation-1' />);
    });
  }

  it('never invokes highlight.js for oversized content', () => {
    expect(LARGE_TOOL_ARGS.length).toBeGreaterThan(50_000);
    renderEditor(LARGE_TOOL_ARGS, 'json');

    expect(highlightBlockSpy).not.toHaveBeenCalled();
    expect(highlightAutoSpy).not.toHaveBeenCalled();
  });

  it('renders oversized content fully without highlighting', () => {
    renderEditor(LARGE_TOOL_ARGS, 'json');

    const code = container.querySelector('pre code');
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe(LARGE_TOOL_ARGS);
  });

  it('highlights normal content with an explicit language instead of auto-detection', () => {
    renderEditor('{"key": "value"}', 'json');

    expect(highlightAutoSpy).not.toHaveBeenCalled();
    const code = container.querySelector('pre code');
    expect(code).not.toBeNull();
    expect(code!.className).toContain('language-json');
  });

  it('normalizes unknown languages to plaintext instead of auto-detecting', () => {
    renderEditor('plain tool output line\nanother line', 'foobar-not-a-language');

    expect(highlightAutoSpy).not.toHaveBeenCalled();
    const code = container.querySelector('pre code');
    expect(code).not.toBeNull();
    expect(code!.className).toContain('language-plaintext');
  });
});
