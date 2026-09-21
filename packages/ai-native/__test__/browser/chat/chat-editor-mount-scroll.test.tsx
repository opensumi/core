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
 * Regression: restoring a long ACP session mounts hundreds of static code
 * blocks. Each mount used to run a leading-edge throttled
 * scrollIntoViewIfNeeded during the React commit, forcing a layout per block
 * (7+s of forced reflow when loading a long session). Scroll-to-bottom only
 * matters when the content of an already-mounted block grows (live
 * streaming); a block restored from history never grows again.
 */
describe('CodeEditorWithHighlight auto-scroll bounds', () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollIntoViewSpy: jest.SpyInstance;
  let scrollIntoViewIfNeededSpy: jest.SpyInstance;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // jsdom does not implement either scrolling API; install spies that the
    // component can call so call counts are observable.
    (Element.prototype as any).scrollIntoView = (Element.prototype as any).scrollIntoView || jest.fn();
    (Element.prototype as any).scrollIntoViewIfNeeded = (Element.prototype as any).scrollIntoViewIfNeeded || jest.fn();
    scrollIntoViewSpy = jest.spyOn(Element.prototype as any, 'scrollIntoView');
    scrollIntoViewIfNeededSpy = jest.spyOn(Element.prototype as any, 'scrollIntoViewIfNeeded');

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
    void hljs;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    scrollIntoViewSpy.mockRestore();
    scrollIntoViewIfNeededSpy.mockRestore();
    jest.clearAllMocks();
  });

  function renderEditor(input: string, language?: string) {
    act(() => {
      root.render(<CodeEditorWithHighlight input={input} language={language} relationId='relation-1' />);
    });
  }

  it('does not scroll when a restored block mounts', () => {
    renderEditor('const a = 1;\nconst b = 2;', 'typescript');

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    expect(scrollIntoViewIfNeededSpy).not.toHaveBeenCalled();
  });

  it('scrolls when mounted content grows (live streaming)', async () => {
    renderEditor('const a = 1;', 'typescript');
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <CodeEditorWithHighlight input={'const a = 1;\nconst b = 2;'} language='typescript' relationId='relation-1' />,
      );
    });
    await act(async () => {
      jest.advanceTimersByTime?.(200);
      await Promise.resolve();
    });

    const called = scrollIntoViewSpy.mock.calls.length + scrollIntoViewIfNeededSpy.mock.calls.length;
    expect(called).toBeGreaterThan(0);
  });
});
