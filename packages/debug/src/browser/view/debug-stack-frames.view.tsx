import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, URI, localize } from '@ali/ide-core-browser';
import * as styles from './debug-stack-frames.module.less';
import { DebugStackFramesService } from './debug-stack-frames.service';
import { ViewState } from '@ali/ide-activity-panel';
import * as cls from 'classnames';

export const DebugStackFrameView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const {
    stackFrames,
    framesErrorMessage,
    canLoadMore,
    loadMore,
    currentFrame,
    setCurentFrame,
  }: DebugStackFramesService = useInjectable(DebugStackFramesService);

  const [selected, setSelected] = React.useState();
  const containerStyle = {
    width: viewState.width,
    height: viewState.height,
  } as React.CSSProperties;

  React.useEffect(() => {
    if (currentFrame) {
      setSelected(currentFrame.raw.id);
    }
  }, [currentFrame]);

  const renderStackFrames = (stackFrames) => {
    if (stackFrames) {
      return stackFrames.map((frame) => {
        const clickHandler = () => {
          setCurentFrame(frame);
          if (frame && frame.source) {
            frame.source.open({}, frame);
          }
        };
        return <div className={cls(styles.debug_stack_frames_item, selected === frame.raw.id && styles.selected )} onClick={clickHandler} key={frame.raw.id}>
        <div className={styles.debug_stack_frames_item_label}>
          {frame.raw && frame.raw.name}
        </div>
        <div className={styles.debug_stack_frames_item_description}>
          {frame.raw && frame.raw.source && frame.raw.source.name }
        </div>
        <div className={styles.debug_stack_frames_item_badge}>
        {frame.raw && frame.raw.line}:{frame.raw && frame.raw.column}
        </div>
      </div>;
      });
    } else {
      return <div></div>;
    }
  };

  const renderLoadMoreStackFrames = () => {
    const clickHandler = () => {
      return loadMore();
    };
    return <div className={styles.debug_stack_frames_item} onClick={ clickHandler }>
      <span className={styles.debug_stack_frames_load_more}>{ localize('debug.stack.loadMore') }</span>
    </div>;
  };

  const renderFramesErrorMessage = (message: string) => {
    return <div className={styles.debug_stack_frames_item}>
      <span className={styles.debug_stack_frames_error_message} title={message}>{message}</span>
    </div>;
  };

  return <div className={styles.debug_stack_frames} style={containerStyle}>
    { renderStackFrames(stackFrames) }
    { framesErrorMessage && renderFramesErrorMessage(framesErrorMessage) }
    { canLoadMore && renderLoadMoreStackFrames() }
  </div>;
});
