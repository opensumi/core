import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const virtuosoProps: any[] = [];
const scrollToIndex = jest.fn();
const autoscrollToBottom = jest.fn();

jest.mock('react-virtuoso', () => ({
  Virtuoso: React.forwardRef((props: any, ref: React.ForwardedRef<unknown>) => {
    virtuosoProps.push(props);
    React.useImperativeHandle(ref, () => ({ autoscrollToBottom, scrollToIndex }));
    const visible = props.data.slice(0, 20);
    return React.createElement(
      'div',
      { 'data-testid': 'virtuoso' },
      visible.map((item: any, index: number) =>
        React.createElement(
          'div',
          { key: props.computeItemKey(index, item), 'data-item-key': props.computeItemKey(index, item) },
          props.itemContent(index, item),
        ),
      ),
    );
  }),
}));

jest.mock('react-chat-elements', () => ({
  MessageBox: (props: any) => React.createElement('div', { 'data-message-box-id': props.id }, props.text),
}));

import {
  AgenticVirtualMessageList,
  AgenticVirtualMessageListHandle,
} from '../../../src/browser/chat/AgenticVirtualMessageList';

describe('AgenticVirtualMessageList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    virtuosoProps.length = 0;
    scrollToIndex.mockClear();
    autoscrollToBottom.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('mounts a bounded visible range with stable message keys through the community MessageBox', () => {
    const messages = Array.from({ length: 1000 }, (_, index) => ({ id: `message-${index}` }));
    const renderMessage = jest.fn((message: { id: string }) => ({
      id: message.id,
      position: message.id === 'message-1' ? ('right' as const) : ('left' as const),
      type: 'text' as const,
      text: message.id,
    }));

    act(() => {
      root.render(
        <AgenticVirtualMessageList messages={messages} renderMessage={renderMessage} sessionId='acp:long-history' />,
      );
    });

    expect(container.querySelectorAll('[data-message-box-id]')).toHaveLength(20);
    expect(container.querySelector('[data-message-id="message-0"]')?.getAttribute('data-message-role')).toBe(
      'assistant',
    );
    expect(container.querySelector('[data-message-id="message-1"]')?.getAttribute('data-message-role')).toBe('user');
    expect(renderMessage).toHaveBeenCalledTimes(20);
    expect(container.querySelector('[data-item-key="message-0"]')).not.toBeNull();
    expect(container.querySelector('[data-item-key="message-19"]')).not.toBeNull();
    expect(virtuosoProps.at(-1)).toEqual(
      expect.objectContaining({
        data: messages,
        followOutput: expect.any(Function),
        increaseViewportBy: { bottom: 480, top: 480 },
        overscan: expect.any(Object),
      }),
    );
    expect((container.querySelector('[data-message-id="message-0"]') as HTMLElement).style.display).toBe('flow-root');
  });

  it('exposes bottom scrolling through its public handle', () => {
    const ref = React.createRef<AgenticVirtualMessageListHandle>();
    const messages = [{ id: 'message-0' }, { id: 'message-1' }];

    act(() => {
      root.render(
        <AgenticVirtualMessageList
          ref={ref}
          messages={messages}
          renderMessage={(message) => ({
            id: message.id,
            position: 'left',
            type: 'text',
            text: message.id,
          })}
          sessionId='acp:scroll'
        />,
      );
    });
    act(() => ref.current?.scrollToBottom('smooth'));

    expect(scrollToIndex).toHaveBeenCalledWith({ align: 'end', behavior: 'smooth', index: 1 });
  });

  it('does not restore the initial reading position again when messages update in the same session', () => {
    const animationFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const renderMessage = (message: { id: string; text: string }) => ({
      id: message.id,
      position: 'left',
      type: 'text',
      text: message.text,
    });

    act(() => {
      root.render(
        <AgenticVirtualMessageList
          messages={[{ id: 'message-0', text: 'initial' }]}
          renderMessage={renderMessage}
          sessionId='acp:stable-stream'
        />,
      );
    });
    const initialRestoreCount = scrollToIndex.mock.calls.length;
    const initialItemContent = virtuosoProps.at(-1).itemContent;

    act(() => {
      root.render(
        <AgenticVirtualMessageList
          messages={[{ id: 'message-0', text: 'updated stream content' }]}
          renderMessage={renderMessage}
          sessionId='acp:stable-stream'
        />,
      );
    });

    expect(scrollToIndex).toHaveBeenCalledTimes(initialRestoreCount);
    expect(virtuosoProps.at(-1).itemContent).toBe(initialItemContent);
    animationFrame.mockRestore();
  });
});
