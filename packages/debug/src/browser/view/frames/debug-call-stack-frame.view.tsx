import cls from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { RecycleList } from '@opensumi/ide-components';
import {
  DisposableCollection,
  ViewState,
  getIcon,
  isUndefined,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';

import { IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugStackFrame, ShowMoreDebugStackFrame } from '../../model';
import { DebugThread } from '../../model/debug-thread';

import styles from './debug-call-stack.module.less';
import { DebugCallStackService } from './debug-call-stack.service';

export interface DebugStackSessionViewProps {
  frames: DebugStackFrame[];
  session: DebugSession;
  thread: DebugThread;
  viewState: ViewState;
  indent?: number;
  isBottom?: boolean;
}

export const DebugStackFramesView = (props: DebugStackSessionViewProps) => {
  const { viewState, frames: rawFrames, thread, indent = 0, session, isBottom } = props;
  const [selected, setSelected] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [frames, setFrames] = useState<(DebugStackFrame | ShowMoreDebugStackFrame)[]>([]);
  const [framesErrorMessage, setFramesErrorMessage] = useState<string>('');
  const [canLoadMore, setCanLoadMore] = useState<boolean>(false);
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const currentFrames = useRef<(DebugStackFrame | ShowMoreDebugStackFrame)[]>([]);
  const debugCallStackService = useInjectable<DebugCallStackService>(DebugCallStackService);

  const loadMore = useCallback(async () => {
    if (!thread) {
      return;
    }
    const remainingFramesCount =
      typeof thread.stoppedDetails?.totalFrames === 'number'
        ? thread.stoppedDetails?.totalFrames - thread.frameCount
        : undefined;
    const frames = await thread.fetchFrames(remainingFramesCount);
    updateFrames(frames);
  }, [frames]);

  const frameOpenSource = (frame: DebugStackFrame) => {
    if (frame && frame.source) {
      frame.source.open({}, frame);
    }
  };

  const expandFrame = useCallback(
    (frame: ShowMoreDebugStackFrame) => {
      const expanedFrames = currentFrames.current.slice(0);
      let index = -1;
      if (!frame.nextFrame) {
        index = expanedFrames.length;
      } else {
        index = expanedFrames.findIndex((f) => DebugStackFrame.is(f) && f.id === frame.nextFrame?.id);
      }
      if (index > -1) {
        expanedFrames.splice(index - 1, 1, ...frame.frames);
        currentFrames.current = expanedFrames;
        setFrames(expanedFrames);
      }
    },
    [currentFrames.current],
  );

  const mergeFrames = useCallback(
    (current: (DebugStackFrame | ShowMoreDebugStackFrame)[], frames: DebugStackFrame[]) => {
      const len = frames.length;
      let offset = -1;
      let lastFrame = current.length > 0 ? current[current.length + offset] : undefined;
      while (lastFrame && !DebugStackFrame.is(lastFrame)) {
        offset -= 1;
        lastFrame = current[current.length + offset];
      }
      // 合并位置调整，方便将进一步加载的含 `frames[i].source?.raw.origin` 进行合并
      const results: (DebugStackFrame | ShowMoreDebugStackFrame)[] = current.slice(0, current.length + offset + 1);

      const startIndex = lastFrame ? frames.findIndex((frame) => frame.id === lastFrame?.id) + 1 : 0;
      let showMoreFrames: DebugStackFrame[] = [];
      let showMoreOrigin;
      let hasOrigin = false;
      for (let i = startIndex; i < len; i++) {
        if (frames[i].source?.raw.origin) {
          if (hasOrigin) {
            if (showMoreOrigin === frames[i].source?.raw.origin) {
              showMoreFrames.push(frames[i]);
              continue;
            } else {
              if (showMoreFrames.length > 1) {
                results.push(
                  new ShowMoreDebugStackFrame(frames[i], showMoreFrames, session, showMoreOrigin, expandFrame),
                );
                offset -= showMoreFrames.length - 1;
              } else {
                results.push(showMoreFrames[0]);
              }
              showMoreFrames = [];
              hasOrigin = false;
              showMoreOrigin = frames[i].source?.raw.origin;
              showMoreFrames.push(frames[i]);
            }
          } else {
            hasOrigin = true;
            showMoreFrames.push(frames[i]);
            showMoreOrigin = frames[i].source?.raw.origin;
          }
        } else {
          if (hasOrigin && showMoreFrames.length > 0) {
            if (showMoreFrames.length > 1) {
              results.push(
                new ShowMoreDebugStackFrame(frames[i], showMoreFrames, session, showMoreOrigin, expandFrame),
              );
              offset -= showMoreFrames.length - 1;
            } else {
              results.push(showMoreFrames[0]);
            }
            showMoreFrames = [];
            hasOrigin = false;
          }
          results.push(frames[i]);
        }
      }
      if (hasOrigin && showMoreFrames.length > 0) {
        if (showMoreFrames.length > 1) {
          results.push(new ShowMoreDebugStackFrame(undefined, showMoreFrames, session, showMoreOrigin, expandFrame));
        } else {
          results.push(showMoreFrames[0]);
        }
      }
      return results;
    },
    [],
  );

  const updateFrames = useCallback(
    (frames: DebugStackFrame[]) => {
      currentFrames.current = mergeFrames(currentFrames.current, frames);
      setFrames(currentFrames.current);
    },
    [frames, mergeFrames],
  );

  const updateSelected = useCallback(
    (value: number | undefined) => {
      setSelected(value);
    },
    [selected],
  );

  useEffect(() => {
    updateFrames([...rawFrames]);

    const disposable = new DisposableCollection();

    disposable.push(
      manager.onDidChangeActiveDebugSession(({ previous }) => {
        if (previous && previous !== thread.session) {
          updateSelected(undefined);
        }
      }),
    );

    return () => {
      disposable.dispose();
    };
  }, []);

  useEffect(() => {
    if (thread) {
      const hasSourceFrame = thread.frames.find((e: DebugStackFrame) => !!e.source);
      if (hasSourceFrame) {
        updateSelected(hasSourceFrame.raw.id);
        frameOpenSource(hasSourceFrame);
      }
    }
  }, [thread.frameCount]);

  useEffect(() => {
    if (thread) {
      if (thread.stoppedDetails) {
        const { framesErrorMessage, totalFrames } = thread.stoppedDetails;
        setFramesErrorMessage(framesErrorMessage || '');
        if (totalFrames && totalFrames > thread.frameCount) {
          setCanLoadMore(true);
        } else {
          setCanLoadMore(false);
        }
      } else {
        setCanLoadMore(false);
      }
    } else {
      setCanLoadMore(false);
    }
  }, [frames]);

  const template = ({ data }) => {
    const frame: DebugStackFrame | ShowMoreDebugStackFrame = data;
    const isLabel = DebugStackFrame.is(frame) && frame.raw.presentationHint === 'label';
    const isSubtle = DebugStackFrame.is(frame) && frame.raw.presentationHint === 'subtle';
    const isDeemphasize = DebugStackFrame.is(frame) && frame.raw?.source?.presentationHint === 'deemphasize';
    const onClickHandler = useCallback(() => {
      if (isLabel || isSubtle) {
        return;
      }
      if (!DebugStackFrame.is(frame)) {
        frame.open();
        return;
      }
      manager.updateCurrentSession(frame.session);

      frame.session.currentThread = frame.thread;
      updateSelected(frame.raw.id);
      frameOpenSource(frame);
    }, [data]);

    const restartFrame = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!DebugStackFrame.is(frame)) {
        return;
      }
      if (frame.canRestart) {
        frame.restart();
      }
    };

    const frameItemStyle = {
      paddingLeft: `${indent}px`,
    };

    if (DebugStackFrame.is(frame) && isDeemphasize) {
      frameItemStyle['color'] = 'var(--list-deemphasizedForeground)';
    }

    const renderFrame = useCallback((frame) => {
      if (DebugStackFrame.is(frame)) {
        return (
          <>
            <span
              className={cls(styles.debug_stack_frames_item_label, isLabel && styles.label, isSubtle && styles.subtle)}
            >
              {frame.raw && frame.raw.name}
            </span>
            {!isLabel && (
              <span className={styles.debug_stack_frames_item_description}>
                {(frame.raw && frame.raw.source && frame.raw.source.name) || localize('debug.stack.frame.noSource')}
              </span>
            )}
            <>
              {frame.canRestart && (
                <a
                  title=''
                  onClick={(event) => restartFrame(event)}
                  className={cls(styles.debug_restart_frame_icon, getIcon('debug-restart-frame'))}
                ></a>
              )}
              {!isLabel && !isDeemphasize && (
                <div className={cls(!isUndefined(frame.raw.line) && styles.debug_stack_frames_item_badge)}>
                  {frame.raw && frame.raw.line}
                  {!isUndefined(frame.raw.line) && ':'}
                  {frame.raw && frame.raw.column}
                </div>
              )}
            </>
          </>
        );
      } else {
        return <span className={styles.debug_stack_frames_load_more}>{frame.name}</span>;
      }
    }, []);

    return (
      <div
        style={frameItemStyle}
        className={cls(
          styles.debug_stack_frames_item,
          isLabel && styles.is_label,
          DebugStackFrame.is(frame) && selected === frame.raw.id && styles.selected,
          DebugStackFrame.is(frame) &&
            !(frame.raw && frame.raw.source && frame.raw.source.name) &&
            styles.debug_stack_frames_item_hidden,
        )}
        onClick={onClickHandler}
        onContextMenu={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
          debugCallStackService.handleContextMenu(event, data)
        }
      >
        {renderFrame(frame)}
      </div>
    );
  };

  const renderLoadMoreStackFrames = useCallback(() => {
    const onClickHandler = async () => {
      setIsLoading(true);
      await loadMore();
      setIsLoading(false);
    };
    return (
      <div className={styles.debug_stack_frames_item} onClick={onClickHandler}>
        <span className={styles.debug_stack_frames_load_more}>{localize('debug.stack.loadMore')}</span>
      </div>
    );
  }, [isLoading, loadMore]);

  const renderLoading = useCallback(
    () => (
      <div className={styles.debug_stack_frames_item}>
        <span className={styles.debug_stack_frames_load_more}>{localize('debug.stack.loading')}</span>
      </div>
    ),
    [],
  );

  const renderFramesErrorMessage = useCallback(
    (message: string) => (
      <div className={styles.debug_stack_frames_item}>
        <span className={styles.debug_stack_frames_error_message} title={message}>
          {message}
        </span>
      </div>
    ),
    [],
  );

  if (framesErrorMessage) {
    return <div className={styles.debug_stack_frames}>{renderFramesErrorMessage(framesErrorMessage)}</div>;
  }

  const footer = useCallback(() => {
    if (isLoading) {
      return renderLoading();
    } else if (canLoadMore) {
      return renderLoadMoreStackFrames();
    }
    return null;
  }, [isLoading, canLoadMore]);

  return (
    <RecycleList
      data={frames}
      template={template}
      itemHeight={22}
      width={viewState.width}
      height={(isLoading || canLoadMore ? (frames.length + 1) * 22 : frames.length * 22) + (isBottom ? 10 : 0)}
      footer={isLoading || canLoadMore ? footer : undefined}
    />
  );
};
