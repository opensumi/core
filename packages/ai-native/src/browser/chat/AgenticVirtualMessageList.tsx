import * as React from 'react';
import { MessageBox, MessageBoxType } from 'react-chat-elements';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

export interface AgenticVirtualMessage {
  readonly id: string;
}

export interface AgenticVirtualMessageListHandle {
  maintainBottom(): void;
  scrollToBottom(behavior?: 'auto' | 'smooth'): void;
}

export interface AgenticVirtualMessageListProps<T extends AgenticVirtualMessage> {
  className?: string;
  messages: readonly T[];
  renderMessage(message: T): {
    id: string | number;
    position?: string;
    text: React.ReactNode;
    [key: string]: unknown;
  };
  sessionId: string;
}

type ReadingAnchor =
  | { kind: 'bottom' }
  | {
      kind: 'message';
      messageId: string;
      offset: number;
    };

const readingAnchors = new Map<string, ReadingAnchor>();
const interactiveViewportBuffer = { bottom: 480, top: 480 } as const;

function getInitialLocation<T extends AgenticVirtualMessage>(sessionId: string, messages: readonly T[]) {
  const anchor = readingAnchors.get(sessionId);
  if (!anchor || anchor.kind === 'bottom') {
    return messages.length > 0 ? { index: messages.length - 1, align: 'end' as const } : 0;
  }
  const index = messages.findIndex((message) => message.id === anchor.messageId);
  return index >= 0 ? { index, align: 'start' as const, offset: -anchor.offset } : 0;
}

function shouldRestoreBottom(sessionId: string): boolean {
  const anchor = readingAnchors.get(sessionId);
  return !anchor || anchor.kind === 'bottom';
}

type InitialLocation = ReturnType<typeof getInitialLocation>;

function AgenticVirtualMessageListInner<T extends AgenticVirtualMessage>(
  { className, messages, renderMessage, sessionId }: AgenticVirtualMessageListProps<T>,
  ref: React.ForwardedRef<AgenticVirtualMessageListHandle>,
) {
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const scrollerRef = React.useRef<HTMLElement | null>(null);
  const rangeStartRef = React.useRef(0);
  const atBottomRef = React.useRef(true);
  const restoringBottomRef = React.useRef(false);
  const bottomRangeReachedRef = React.useRef(false);
  const restorationFrameRef = React.useRef<number>();
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;

  const restoreBottom = React.useCallback(() => {
    if (messagesRef.current.length === 0) {
      return;
    }
    virtuosoRef.current?.scrollToIndex({
      index: messagesRef.current.length - 1,
      align: 'end',
    });
  }, []);

  const captureReadingAnchor = React.useCallback(() => {
    const scroller = scrollerRef.current;
    const scrollerRect = scroller?.getBoundingClientRect();
    const renderedItems = Array.from(scroller?.querySelectorAll<HTMLElement>('[data-message-id]') || []);
    const lastMessageId = messagesRef.current[messagesRef.current.length - 1]?.id;
    const lastMessageVisible = renderedItems.some(
      (item) =>
        item.dataset.messageId === lastMessageId &&
        (!scrollerRect || item.getBoundingClientRect().top < scrollerRect.bottom),
    );
    if (restoringBottomRef.current || atBottomRef.current || bottomRangeReachedRef.current || lastMessageVisible) {
      readingAnchors.set(sessionId, { kind: 'bottom' });
      return;
    }
    const visibleItem = renderedItems.find(
      (item) => !scrollerRect || item.getBoundingClientRect().bottom > scrollerRect.top,
    );
    const visibleMessageId = visibleItem?.dataset.messageId;
    if (visibleItem && visibleMessageId && scrollerRect) {
      readingAnchors.set(sessionId, {
        kind: 'message',
        messageId: visibleMessageId,
        offset: visibleItem.getBoundingClientRect().top - scrollerRect.top,
      });
      return;
    }
    const message = messagesRef.current[rangeStartRef.current];
    if (message) {
      readingAnchors.set(sessionId, { kind: 'message', messageId: message.id, offset: 0 });
    }
  }, [sessionId]);

  React.useEffect(() => captureReadingAnchor, [captureReadingAnchor]);

  React.useImperativeHandle(
    ref,
    () => ({
      maintainBottom: () => {
        if (atBottomRef.current) {
          virtuosoRef.current?.autoscrollToBottom();
        }
      },
      scrollToBottom: (behavior = 'auto') => {
        if (messagesRef.current.length === 0) {
          return;
        }
        virtuosoRef.current?.scrollToIndex({
          index: messagesRef.current.length - 1,
          align: 'end',
          behavior,
        });
      },
    }),
    [],
  );

  const initialLocationRef = React.useRef<{ location: InitialLocation; sessionId: string }>();
  if (!initialLocationRef.current || initialLocationRef.current.sessionId !== sessionId) {
    initialLocationRef.current = {
      location: getInitialLocation(sessionId, messages),
      sessionId,
    };
  }
  const initialTopMostItemIndex = initialLocationRef.current.location;

  React.useEffect(() => {
    if (messagesRef.current.length === 0) {
      return;
    }
    restoringBottomRef.current = shouldRestoreBottom(sessionId);
    const animationFrame = requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex(initialTopMostItemIndex);
      if (restoringBottomRef.current) {
        restoreBottom();
      }
    });
    return () => {
      cancelAnimationFrame(animationFrame);
      if (restorationFrameRef.current !== undefined) {
        cancelAnimationFrame(restorationFrameRef.current);
        restorationFrameRef.current = undefined;
      }
    };
  }, [initialTopMostItemIndex, restoreBottom, sessionId]);

  const renderItem = React.useCallback(
    (_index: number, message: T) => {
      const data = renderMessage(message);
      return (
        <div
          data-message-id={message.id}
          data-message-role={data?.position === 'right' ? 'user' : 'assistant'}
          data-testid='agentic-message-row'
        >
          <MessageBox {...(data as unknown as MessageBoxType)} />
        </div>
      );
    },
    [renderMessage],
  );

  return (
    <div className={`rce-container-mlist ${className || ''}`} data-testid='agentic-virtual-message-list'>
      <Virtuoso
        ref={virtuosoRef}
        className='rce-mlist'
        style={{ height: '100%' }}
        data={messages}
        computeItemKey={(_index, message) => message.id}
        defaultItemHeight={96}
        increaseViewportBy={interactiveViewportBuffer}
        initialTopMostItemIndex={0}
        overscan={{ main: 160, reverse: 160 }}
        followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
        atBottomStateChange={(atBottom) => {
          atBottomRef.current = atBottom;
          if (atBottom) {
            readingAnchors.set(sessionId, { kind: 'bottom' });
          }
        }}
        rangeChanged={(range) => {
          rangeStartRef.current = range.startIndex;
          bottomRangeReachedRef.current = range.endIndex >= messagesRef.current.length - 1;
          if (restoringBottomRef.current) {
            if (bottomRangeReachedRef.current) {
              restoringBottomRef.current = false;
            } else if (restorationFrameRef.current === undefined) {
              restorationFrameRef.current = requestAnimationFrame(() => {
                restorationFrameRef.current = undefined;
                restoreBottom();
              });
            }
          }
          if (!atBottomRef.current) {
            captureReadingAnchor();
          }
        }}
        scrollerRef={(element) => {
          scrollerRef.current = element instanceof HTMLElement ? element : null;
        }}
        itemContent={renderItem}
      />
    </div>
  );
}

export const AgenticVirtualMessageList = React.forwardRef(AgenticVirtualMessageListInner) as <
  T extends AgenticVirtualMessage,
>(
  props: AgenticVirtualMessageListProps<T> & { ref?: React.ForwardedRef<AgenticVirtualMessageListHandle> },
) => React.ReactElement;
