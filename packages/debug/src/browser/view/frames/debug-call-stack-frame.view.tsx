import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { RecycleList } from '@opensumi/ide-components';
import {
  ViewState,
  isUndefined,
  useInjectable,
  localize,
  DisposableCollection,
  getIcon,
} from '@opensumi/ide-core-browser';

import { IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugStackFrame } from '../../model';
import { DebugThread } from '../../model/debug-thread';

import styles from './debug-call-stack.module.less';
import { DebugCallStackService } from './debug-call-stack.service';


export interface DebugStackSessionViewProps {
  frames: DebugStackFrame[];
  session: DebugSession;
  thread: DebugThread;
  viewState: ViewState;
  indent?: number;
}

export const DebugStackFramesView = observer((props: DebugStackSessionViewProps) => {
  const { viewState, frames: rawFrames, thread, indent = 0, session } = props;
  const [selected, setSelected] = React.useState<number | undefined>();
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [frames, setFrames] = React.useState<DebugStackFrame[]>([]);
  const [framesErrorMessage, setFramesErrorMessage] = React.useState<string>('');
  const [canLoadMore, setCanLoadMore] = React.useState<boolean>(false);
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const debugCallStackService = useInjectable<DebugCallStackService>(DebugCallStackService);

  const loadMore = async () => {
    if (!thread) {
      return;
    }
    const remainingFramesCount =
      typeof thread.stoppedDetails?.totalFrames === 'number'
        ? thread.stoppedDetails?.totalFrames - thread.frameCount
        : undefined;
    const frames = await thread.fetchFrames(remainingFramesCount);
    setFrames(frames);
  };

  const frameOpenSource = (frame: DebugStackFrame) => {
    if (frame && frame.source) {
      frame.source.open({}, frame);
    }
  };

  React.useEffect(() => {
    setFrames([...rawFrames]);

    const disposable = new DisposableCollection();

    disposable.push(
      manager.onDidChangeActiveDebugSession(({ previous }) => {
        if (previous && previous !== thread.session) {
          setSelected(undefined);
        }
      }),
    );

    if (session) {
      disposable.push(
        session.onDidChangeCallStack(() => {
          setFrames([...thread.frames]);
        }),
      );
    }

    return () => {
      disposable.dispose();
    };
  }, []);

  React.useEffect(() => {
    if (thread) {
      const hasSourceFrame = thread.frames.find((e: DebugStackFrame) => !!e.source);
      if (hasSourceFrame) {
        setSelected(hasSourceFrame.raw.id);
        frameOpenSource(hasSourceFrame);
      }
    }
  }, [thread.frameCount]);

  React.useEffect(() => {
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
    const frame: DebugStackFrame = data;
    const isLabel = frame.raw.presentationHint === 'label';
    const isSubtle = frame.raw.presentationHint === 'subtle';
    const clickHandler = () => {
      if (isLabel || isSubtle) {
        return;
      }
      manager.updateCurrentSession(frame.session);

      frame.session.currentThread = frame.thread;
      setSelected(frame.raw.id);
      frameOpenSource(frame);
    };

    const restartFrame = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();

      if (frame.canRestart) {
        frame.restart();
      }
    };

    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className={cls(
          styles.debug_stack_frames_item,
          selected === frame.raw.id && styles.selected,
          !(frame.raw && frame.raw.source && frame.raw.source.name) && styles.debug_stack_frames_item_hidden,
        )}
        onClick={clickHandler}
        onContextMenu={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
          debugCallStackService.handleContextMenu(event, data)
        }
      >
        <span className={cls(styles.debug_stack_frames_item_label, isLabel && styles.label, isSubtle && styles.subtle)}>
          {frame.raw && frame.raw.name}
        </span>
        <span className={styles.debug_stack_frames_item_description}>
          {(frame.raw && frame.raw.source && frame.raw.source.name) || localize('debug.stack.frame.noSource')}
        </span>
        <>
          <a
            title=''
            onClick={(event) => restartFrame(event)}
            className={cls(styles.debug_restart_frame_icon, getIcon('debug-restart-frame'))}
          ></a>
          <div className={cls(!isUndefined(frame.raw.line) && styles.debug_stack_frames_item_badge)}>
            {frame.raw && frame.raw.line}
            {!isUndefined(frame.raw.line) && ':'}
            {frame.raw && frame.raw.column}
          </div>
        </>
      </div>
    );
  };

  const renderLoadMoreStackFrames = () => {
    const clickHandler = async () => {
      setIsLoading(true);
      await loadMore();
      setIsLoading(false);
    };
    return (
      <div className={styles.debug_stack_frames_item} onClick={clickHandler}>
        <span className={styles.debug_stack_frames_load_more}>{localize('debug.stack.loadMore')}</span>
      </div>
    );
  };

  const renderLoading = () => (
    <div className={styles.debug_stack_frames_item}>
      <span className={styles.debug_stack_frames_load_more}>{localize('debug.stack.loading')}</span>
    </div>
  );

  const renderFramesErrorMessage = (message: string) => (
    <div className={styles.debug_stack_frames_item}>
      <span className={styles.debug_stack_frames_error_message} title={message}>
        {message}
      </span>
    </div>
  );

  if (framesErrorMessage) {
    return <div className={styles.debug_stack_frames}>{renderFramesErrorMessage(framesErrorMessage)}</div>;
  }

  const footer = () => {
    if (isLoading) {
      return renderLoading();
    } else if (canLoadMore) {
      return renderLoadMoreStackFrames();
    }
    return null;
  };

  return (
    <RecycleList
      data={frames}
      template={template}
      itemHeight={22}
      width={viewState.width}
      height={isLoading || canLoadMore ? (frames.length + 1) * 22 : frames.length * 22}
      footer={isLoading || canLoadMore ? footer : undefined}
    />
  );
});
