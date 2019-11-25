import * as React from 'react';
import { DebugBreakpointsService } from './debug-breakpoints.service';
import { useInjectable, ViewState, URI } from '@ali/ide-core-browser';
import * as styles from './debug-breakpoints.module.less';
import * as cls from 'classnames';
import { CheckBox, CheckBoxSize } from '@ali/ide-core-browser/lib/components/input';
import { observer } from 'mobx-react-lite';
import { DebugBreakpoint, DebugExceptionBreakpoint } from '../model';
import { RecycleList } from '@ali/ide-core-browser/lib/components';
import Badge from '@ali/ide-core-browser/lib/components/badge';

export interface BreakpointItem {
  name: string;
  id: string;
  description: string;
  breakpoint: DebugBreakpoint | DebugExceptionBreakpoint;
}

export const DebugBreakpointView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const {
    nodes,
    enable,
    inDebugMode,
  }: DebugBreakpointsService = useInjectable(DebugBreakpointsService);
  const template = ({data}: {
    data: BreakpointItem,
  }) => {
    return <BreakpointItem data={data} isDebugMode={inDebugMode}></BreakpointItem>;
  };

  const containerStyle =  {
    height: viewState.height,
    width: viewState.width,
  } as React.CSSProperties;

  return <div className={cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled)}>
    <RecycleList
      data = {nodes}
      template = {template}
      sliceSize = {15}
      style={containerStyle}
    />
  </div>;
});

export const BreakpointItem = ({
  data,
  isDebugMode,
}: {
  data: BreakpointItem,
  isDebugMode: boolean,
}) => {
  const [enabled, setEnabled] = React.useState<boolean>(data.breakpoint.enabled);

  const changeHandler = () => {
    data.breakpoint.setEnabled(!enabled);
    setEnabled(!enabled);
  };

  const clickHandler = (event: React.MouseEvent) => {
    data.breakpoint.open({preview: true});
  };

  const isDebugBreakpoint = data.breakpoint instanceof DebugBreakpoint;

  const verified = !isDebugMode ? true : data.breakpoint instanceof DebugBreakpoint && data.breakpoint.verified;

  return <div className={cls(styles.debug_breakpoints_item)}>
    <div className={cls(isDebugBreakpoint ? !verified ? 'kaitian-debug-breakpoint-unverified' : enabled ? 'kaitian-debug-breakpoint' : 'kaitian-debug-breakpoint-disabled' : '', styles.debug_breakpoints_icon)}></div>
    <CheckBox size={CheckBoxSize.SMALL} id={data.id} defaultChecked={enabled} onChange={changeHandler}></CheckBox>
    <div className={styles.debug_breakpoints_wrapper} onClick={clickHandler}>
      <span className={styles.debug_breakpoints_name}>{data.name}</span>
      <span className={styles.debug_breakpoints_description}>{data.description}</span>
    </div>
    {
      data.breakpoint.line && <Badge>{data.breakpoint.line}</Badge>
    }

  </div>;
};
