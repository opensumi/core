import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, URI, localize, isUndefined } from '@ali/ide-core-browser';
import * as styles from './debug-stack-frames.module.less';
import { DebugStackFramesService } from './debug-stack-frames.service';
import { ViewState } from '@ali/ide-core-browser';
import * as cls from 'classnames';
import { RecycleList } from '@ali/ide-core-browser/lib/components';
import { DebugStackFrame } from '../model';

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
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const containerStyle = {
    width: viewState.width,
    height: viewState.height,
  } as React.CSSProperties;

  React.useEffect(() => {
    if (currentFrame) {
      setSelected(currentFrame.raw.id);
    }
  }, [currentFrame]);

  const template = ({
    data,
  }) => {
    const frame: DebugStackFrame = data;
    const isLabel = frame.raw.presentationHint === 'label';
    const isSubtle = frame.raw.presentationHint === 'subtle';
    const clickHandler = () => {
      if (isLabel || isSubtle) {
        return ;
      }
      setCurentFrame(frame);
      if (frame && frame.source) {
        frame.source.open({}, frame);
      }
    };

    return <div className={cls(styles.debug_stack_frames_item, selected === frame.raw.id && styles.selected )} onClick={clickHandler}>
      <span className={cls(styles.debug_stack_frames_item_label, isLabel && styles.label, isSubtle && styles.subtle)}>
        {frame.raw && frame.raw.name}
      </span>
      <span className={styles.debug_stack_frames_item_description}>
        {frame.raw && frame.raw.source && frame.raw.source.name }
      </span>
      <div className={cls(!isUndefined(frame.raw.line) && styles.debug_stack_frames_item_badge)}>
        {frame.raw && frame.raw.line}{!isUndefined(frame.raw.line) && ':'}{frame.raw && frame.raw.column}
      </div>
    </div>;
  };

  const renderLoadMoreStackFrames = () => {
    const clickHandler = async () => {
      setIsLoading(true);
      await loadMore();
      setIsLoading(false);
    };
    return <div className={styles.debug_stack_frames_item} onClick={ clickHandler }>
      <span className={styles.debug_stack_frames_load_more}>{ localize('debug.stack.loadMore') }</span>
    </div>;
  };

  const renderLoading = () => {
    return <div>loading...</div>;
  };

  const renderFramesErrorMessage = (message: string) => {
    return <div className={styles.debug_stack_frames_item}>
      <span className={styles.debug_stack_frames_error_message} title={message}>{message}</span>
    </div>;
  };

  if (framesErrorMessage) {
    return <div className={styles.debug_stack_frames} style={containerStyle}>
      { renderFramesErrorMessage(framesErrorMessage) }
    </div>;
  }

  return <RecycleList
    data={stackFrames}
    template = {template}
    sliceSize = {30}
    style={containerStyle}
    placeholders = {
      {drained: renderLoadMoreStackFrames(), loading: renderLoading()}
    }
    isDrained = {canLoadMore}
    isLoading = {isLoading}
  />;

});
