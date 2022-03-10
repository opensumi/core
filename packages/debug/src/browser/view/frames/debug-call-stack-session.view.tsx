import cls from 'classnames';
import React from 'react';

import { ViewState, getIcon, useInjectable, DisposableCollection } from '@opensumi/ide-core-browser';

import { DebugState, IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';
import { DebugSessionManager } from '../../debug-session-manager';
import { DebugThread } from '../../model/debug-thread';

import { DebugStackThreadView } from './debug-call-stack-thread.view';
import styles from './debug-call-stack.module.less';
import { DebugStackOperationView } from './debug-call-stack.operation';
import { DebugCallStackService } from './debug-call-stack.service';

export interface DebugStackSessionViewProps {
  session: DebugSession;
  viewState: ViewState;
  indent: number;
}

export const DebugStackSessionView = (props: DebugStackSessionViewProps) => {
  const { session, viewState, indent } = props;
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const debugCallStackService = useInjectable<DebugCallStackService>(DebugCallStackService);
  const [threads, setThreads] = React.useState<DebugThread[]>([]);
  const [otherThreads, setOtherThreads] = React.useState<DebugThread[]>([]);
  const [multipleThreadPaused, setMultipleThreadPaused] = React.useState<DebugThread[]>([]);
  const [subSession, setSubSession] = React.useState<DebugSession[]>([]);
  const [unfold, setUnfold] = React.useState<boolean>(true);
  const [hover, setHover] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  // 多 session 调试
  const mutipleSession = manager.sessions.length > 1;
  const supportsThreadIdCorrespond = session.supportsThreadIdCorrespond;

  // 从 manager.sessions 中找出 parentSession id 是当前 session id 的 session
  const findSubSessions = () => {
    const hasParentSessions = manager.sessions.filter((s) => s.parentSession);
    const subSession: DebugSession[] = [];
    while (hasParentSessions[0]) {
      if (manager.getSession(hasParentSessions[0].parentSession?.id)?.id === session.id) {
        subSession.push(hasParentSessions[0]);
      }
      hasParentSessions.shift();
    }

    return subSession;
  };

  // 加载更多线程信息
  const fetchOtherThreads = async () => {
    setLoading(true);
    const _threads = await session.fetchThreads();
    setLoading(false);
    setOtherThreads(_threads);
  };

  React.useEffect(() => {
    const createDispose = manager.onDidCreateDebugSession(() => {
      const sub = findSubSessions();
      setSubSession(sub);
    });

    const destroyDispose = manager.onDidDestroyDebugSession(() => {
      const sub = findSubSessions();
      setSubSession(sub);
    });

    return () => {
      createDispose.dispose();
      destroyDispose.dispose();
      setSubSession([]);
    };
  }, []);

  React.useEffect(() => {
    setThreads(Array.from(session.threads));

    const disposable = new DisposableCollection();

    disposable.push(
      session.onDidChange(() => {
        setThreads([...session.threads]);
      }),
    );

    disposable.push(
      session.onDidThread(async ({ body: { reason } }) => {
        if (!session.supportsThreadIdCorrespond) {
          return;
        }

        if (session.state === DebugState.Stopped && reason === 'started') {
          await fetchOtherThreads();
        }
      }),
    );

    disposable.push(
      session.onDidStop(async () => {
        if (!session.supportsThreadIdCorrespond) {
          return;
        }

        const multipleThreads = Array.from(session.multipleThreadPaused.values());
        setMultipleThreadPaused(multipleThreads);

        await fetchOtherThreads();
      }),
    );

    disposable.push(
      session.onDidContinued(async () => {
        if (!session.supportsThreadIdCorrespond) {
          return;
        }

        const multipleThreads = Array.from(session.multipleThreadPaused.values());
        setMultipleThreadPaused(multipleThreads);
      }),
    );

    return () => {
      disposable.dispose();
    };
  }, []);

  // 渲染 "加载更多线程"
  const renderLoadMoreThread = () => {
    if (session.state !== DebugState.Stopped) {
      return null;
    }

    if (supportsThreadIdCorrespond && unfold) {
      return loading ? (
        <div className={styles.debug_stack_item_loading}>
          <span>正在加载线程...</span>
        </div>
      ) : (
        otherThreads.map(
          (thread) =>
            !session.hasInMultipleThreadPaused(thread.raw.id) && (
              <DebugStackThreadView
                key={thread.id}
                indent={mutipleSession ? 16 : 0}
                viewState={viewState}
                thread={thread}
                session={session}
              />
            ),
        )
      );
    }
  };

  const isIncompressible = (stat: DebugSession) => {
    if (stat.threads.some((t) => t.frameCount > 0)) {
      return false;
    }

    const sub = findSubSessions();
    if (sub.length !== 1) {
      return false;
    }

    if (!sub[0].compact) {
      return false;
    }

    return true;
  };

  if (isIncompressible(session)) {
    const sub = findSubSessions();
    return (
      <div className={styles.debug_stack_item}>
        {sub.map((s) => (
          <DebugStackSessionView key={s.id} viewState={viewState} session={s} indent={1} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={styles.debug_stack_item}
      onContextMenu={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        debugCallStackService.handleContextMenu(event, session)
      }
    >
      <div style={{ paddingLeft: indent * 10 + 'px' }}>
        {mutipleSession && (
          <div
            className={styles.debug_stack_item_label}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {(supportsThreadIdCorrespond || threads.length > 0) && (
              <>
                <div className={unfold ? getIcon('down') : getIcon('right')} onClick={() => setUnfold(!unfold)}></div>,
                <div className={cls([getIcon('debug'), styles.debug_session_icon])}></div>,
              </>
            )}
            <div className={styles.debug_stack_item_label_title}>{session.label}</div>
            {hover && <DebugStackOperationView session={session} />}
          </div>
        )}
        {supportsThreadIdCorrespond && unfold
          ? multipleThreadPaused.map((t) => (
              <DebugStackThreadView
                key={t.id}
                indent={mutipleSession ? 16 : 0}
                viewState={viewState}
                thread={t}
                session={session}
              />
            ))
          : null}
        {!supportsThreadIdCorrespond &&
          (!mutipleSession || unfold) &&
          threads.map((thread) => (
            <DebugStackThreadView
              key={thread.id}
              indent={mutipleSession ? 16 : 0}
              viewState={viewState}
              thread={thread}
              session={session}
            />
          ))}
        {subSession.length > 0 &&
          subSession.map(
            (s) => unfold && <DebugStackSessionView key={s.id} viewState={viewState} session={s} indent={1} />,
          )}
        {renderLoadMoreThread()}
      </div>
    </div>
  );
};
