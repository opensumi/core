import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { Simulate, act } from 'react-dom/test-utils';

const useInjectable = jest.fn();

class MockURI {
  static file(path: string) {
    return new MockURI(`file://${path.startsWith('/') ? '' : '/'}${path}`);
  }

  static parse(uri: string) {
    return new MockURI(uri);
  }

  constructor(public readonly value: string) {}

  toString() {
    return this.value;
  }
}

jest.mock('@opensumi/ide-core-browser', () => ({
  AppConfig: Symbol('AppConfig'),
  ConfigProvider: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(React.Fragment, null, children),
  FILE_COMMANDS: {
    REVEAL_IN_EXPLORER: {
      id: 'filetree.revealInExplorer',
    },
  },
  useInjectable: (...args: unknown[]) => useInjectable(...args),
}));

jest.mock('@opensumi/ide-core-common', () => ({
  CommandService: Symbol('CommandService'),
  URI: MockURI,
}));

jest.mock('@opensumi/ide-editor', () => ({
  WorkbenchEditorService: Symbol('WorkbenchEditorService'),
}));

jest.mock('@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent', () => ({
  MarkdownString: class MarkdownString {
    constructor(public readonly value: string) {}
  },
}));

jest.mock('../../src/browser/components/ChatEditor', () => ({
  CodeEditorWithHighlight: ({ input }: { input: string }) => require('react').createElement('pre', null, input),
}));

jest.mock('../../src/browser/layout/panel-layout.service', () => ({
  AIPanelLayoutService: class AIPanelLayoutService {},
}));

import { ChatMarkdown } from '../../src/browser/components/ChatMarkdown';

describe('ChatMarkdown file links', () => {
  let container: HTMLDivElement;
  let root: Root;
  let editorService: { open: jest.Mock };
  let commandService: { executeCommand: jest.Mock };
  let panelLayoutService: { toggleAgenticWorkbenchVisibility: jest.Mock };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    editorService = {
      open: jest.fn(),
    };
    commandService = {
      executeCommand: jest.fn(),
    };
    panelLayoutService = {
      toggleAgenticWorkbenchVisibility: jest.fn(),
    };

    useInjectable.mockImplementation((token: any) => {
      const key = String(token);

      if (key.includes('AppConfig')) {
        return {
          workspaceDir: '/workspace/project',
        };
      }

      if (key.includes('WorkbenchEditorService')) {
        return editorService;
      }

      if (key.includes('CommandService')) {
        return commandService;
      }

      if (token?.name === 'AIPanelLayoutService') {
        return panelLayoutService;
      }

      return undefined;
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  function renderMarkdown(markdown: string) {
    act(() => {
      root.render(<ChatMarkdown markdown={markdown} />);
    });
  }

  it('opens plain file paths and reveals the agentic workbench and explorer first', async () => {
    renderMarkdown('Open packages/ai-native/src/browser/chat/chat.view.acp.tsx:L12-L20');

    const link = container.querySelector('a');
    expect(link?.textContent).toBe('packages/ai-native/src/browser/chat/chat.view.acp.tsx:L12-L20');

    await act(async () => {
      Simulate.click(link!);
    });

    const [uri, options] = editorService.open.mock.calls[0];
    expect(panelLayoutService.toggleAgenticWorkbenchVisibility).toHaveBeenCalledWith(true);
    expect(commandService.executeCommand).toHaveBeenCalledWith('filetree.revealInExplorer', uri);
    expect(uri.toString()).toBe('file:///workspace/project/packages/ai-native/src/browser/chat/chat.view.acp.tsx');
    expect(options).toEqual({
      range: {
        startLineNumber: 12,
        startColumn: 1,
        endLineNumber: 20,
        endColumn: 1,
      },
      revealRangeInCenter: true,
    });
  });

  it('opens a file path wrapped in inline code', async () => {
    renderMarkdown('Open `packages/ai-native/src/browser/components/ChatMarkdown.tsx`');

    const link = container.querySelector('a');
    expect(link?.querySelector('code')?.textContent).toBe('packages/ai-native/src/browser/components/ChatMarkdown.tsx');

    await act(async () => {
      Simulate.click(link!);
    });

    const [uri, options] = editorService.open.mock.calls[0];
    expect(commandService.executeCommand).toHaveBeenCalledWith('filetree.revealInExplorer', uri);
    expect(uri.toString()).toBe('file:///workspace/project/packages/ai-native/src/browser/components/ChatMarkdown.tsx');
    expect(options).toBeUndefined();
  });

  it('does not link paths inside fenced code blocks', () => {
    renderMarkdown('```ts\npackages/ai-native/src/browser/components/ChatMarkdown.tsx\n```');

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('packages/ai-native/src/browser/components/ChatMarkdown.tsx');
  });

  it('keeps http markdown links as normal links', async () => {
    renderMarkdown('[docs](https://example.com/packages/foo.ts)');

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/packages/foo.ts');

    await act(async () => {
      Simulate.click(link!);
    });

    expect(commandService.executeCommand).not.toHaveBeenCalled();
    expect(editorService.open).not.toHaveBeenCalled();
  });

  it('does not nest file links inside normal markdown link labels', async () => {
    renderMarkdown('[packages/ai-native/src/browser/components/ChatMarkdown.tsx](https://example.com/docs)');

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('packages/ai-native/src/browser/components/ChatMarkdown.tsx');
    expect(links[0].getAttribute('href')).toBe('https://example.com/docs');

    await act(async () => {
      Simulate.click(links[0]);
    });

    expect(commandService.executeCommand).not.toHaveBeenCalled();
    expect(editorService.open).not.toHaveBeenCalled();
  });

  it('opens file URI markdown links with a line suffix', async () => {
    renderMarkdown('[file](file:///tmp/foo.ts:L3)');

    const link = container.querySelector('a');
    expect(link?.textContent).toBe('file');

    await act(async () => {
      Simulate.click(link!);
    });

    const [uri, options] = editorService.open.mock.calls[0];
    expect(commandService.executeCommand).toHaveBeenCalledWith('filetree.revealInExplorer', uri);
    expect(uri.toString()).toBe('file:///tmp/foo.ts');
    expect(options).toEqual({
      range: {
        startLineNumber: 3,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 1,
      },
      revealRangeInCenter: true,
    });
  });

  it('opens file paths with line and column suffixes', async () => {
    renderMarkdown('Open packages/ai-native/src/browser/components/ChatMarkdown.tsx:12:34');

    const link = container.querySelector('a');
    expect(link?.textContent).toBe('packages/ai-native/src/browser/components/ChatMarkdown.tsx:12:34');

    await act(async () => {
      Simulate.click(link!);
    });

    const [uri, options] = editorService.open.mock.calls[0];
    expect(uri.toString()).toBe('file:///workspace/project/packages/ai-native/src/browser/components/ChatMarkdown.tsx');
    expect(options).toEqual({
      range: {
        startLineNumber: 12,
        startColumn: 34,
        endLineNumber: 12,
        endColumn: 34,
      },
      revealRangeInCenter: true,
    });
  });
});
