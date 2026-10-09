import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  IClipboardService: Symbol('IClipboardService'),
  useInjectable: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({ onClick, children, ariaLabel }: any) =>
    require('react').createElement('div', { onClick, role: 'button', 'aria-label': ariaLabel, tabIndex: 0 }, children),
  Thumbs: () => null,
}));

jest.mock('@opensumi/ide-core-browser/lib/progress/progress-bar', () => ({
  Progress: () => null,
}));

jest.mock('@opensumi/ide-core-common', () => ({
  ChatRenderRegistryToken: Symbol('ChatRenderRegistryToken'),
  isUndefined: (value: unknown) => value === undefined,
  localize: (key: string) => key,
  runWhenIdle: (callback: () => void) => {
    callback();
    return { dispose: () => undefined };
  },
}));

jest.mock('../../../src/common/index', () => ({
  IChatInternalService: Symbol('IChatInternalService'),
}));

jest.mock('../../../src/browser/chat/chat.internal.service', () => ({
  ChatInternalService: class ChatInternalService {},
}));

jest.mock('../../../src/browser/chat/chat.render.registry', () => ({
  ChatRenderRegistry: class ChatRenderRegistry {},
}));

import { ChatThinkingResult } from '../../../src/browser/components/ChatThinking';

describe('ChatThinkingResult message copy', () => {
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

      if (key.includes('IChatInternalService')) {
        return {
          latestRequestId: 'request-1',
          onChangeRequestId: jest.fn(() => ({ dispose: () => undefined })),
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

  function renderResult(props: { copyContent?: string; hasMessage?: boolean; showRegenerate?: boolean }) {
    act(() => {
      root.render(
        <ChatThinkingResult requestId='request-1' showRegenerate={false} {...props}>
          <div>reply content</div>
        </ChatThinkingResult>,
      );
    });
  }

  function getCopyButton() {
    const button = Array.from(container.querySelectorAll('[role="button"]')).find((item) =>
      item.textContent?.includes('aiNative.chat.message.copy'),
    );
    expect(button).not.toBeUndefined();
    return button as HTMLDivElement;
  }

  it('renders a copy action when copyContent is provided', () => {
    renderResult({ copyContent: 'copyable reply' });

    expect(getCopyButton()).not.toBeUndefined();
  });

  it('does not render a copy action without copyContent', () => {
    renderResult({});

    const button = Array.from(container.querySelectorAll('[role="button"]')).find((item) =>
      item.textContent?.includes('aiNative.chat.message.copy'),
    );
    expect(button).toBeUndefined();
  });

  it('writes message content to the clipboard on click', async () => {
    renderResult({ copyContent: 'copyable reply' });

    await act(async () => {
      getCopyButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('copyable reply');
  });
});
