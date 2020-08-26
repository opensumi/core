import * as React from 'react';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugBreakpointsService } from './debug-breakpoints.service';
import { useInjectable, ViewState } from '@ali/ide-core-browser';
import * as styles from './debug-breakpoints.module.less';
import * as cls from 'classnames';
import { CheckBox } from '@ali/ide-components';
import { observer } from 'mobx-react-lite';
import { DebugBreakpoint, DebugExceptionBreakpoint, isDebugBreakpoint, isRuntimeBreakpoint, getStatus } from '../../breakpoint';
import { RecycleList } from '@ali/ide-core-browser/lib/components';
import { Badge } from '@ali/ide-components';
import { DebugSessionManager } from '../../debug-session-manager';
import { IDebugSessionManager } from '../../../common';

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
    toggleBreakpointEnable,
  }: DebugBreakpointsService = useInjectable(DebugBreakpointsService);
  const template = ({ data }: {
    data: BreakpointItem,
  }) => {
    return <BreakpointItem toggle={ () => toggleBreakpointEnable(data.breakpoint) } data={ data } isDebugMode={ inDebugMode }></BreakpointItem>;
  };

  const containerStyle = {
    height: viewState.height,
    width: viewState.width,
  } as React.CSSProperties;

  return <div className={ cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled) }>
    <RecycleList
      data={ nodes }
      template={ template }
      sliceSize={ 15 }
      style={ containerStyle }
    />
  </div>;
});

export const BreakpointItem = ({
  data,
  toggle,
  isDebugMode,
}: {
  data: BreakpointItem,
  toggle: () => void,
  isDebugMode: boolean,
}) => {
  const defaultValue = isDebugBreakpoint(data.breakpoint) ? data.breakpoint.enabled : !!(data.breakpoint.default);
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const [enabled, setEnabled] = React.useState<boolean>(defaultValue);
  const [status, setStatus] = React.useState<DebugProtocol.Breakpoint | false | undefined>(undefined);

  const changeHandler = () => {
    toggle();
    setEnabled(!enabled);
  };

  const clickHandler = (event: React.MouseEvent) => {
    // data.breakpoint.open({preview: true});
  };

  React.useEffect(() => {
    manager.onDidChangeActiveDebugSession(() => {
      if (isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint)) {
        const status = getStatus(data.breakpoint);
        setStatus(status);
      }
    });

    if (isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint)) {
      const status = getStatus(data.breakpoint);
      setStatus(status);
    }
  }, []);

  const verified = !isDebugMode ? true : (isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint));

  return <div className={ cls(styles.debug_breakpoints_item) }>
    <div className={ cls(isDebugBreakpoint(data.breakpoint) ? !verified ? 'kaitian-debug-breakpoint-unverified' : enabled ? 'kaitian-debug-breakpoint' : 'kaitian-debug-breakpoint-disabled' : '', styles.debug_breakpoints_icon) }></div>
    <CheckBox id={ data.id } defaultChecked={ enabled } onChange={ changeHandler }></CheckBox>
    <div className={ styles.debug_breakpoints_wrapper } onClick={ clickHandler }>
      <span className={ styles.debug_breakpoints_name }>{ data.name }</span>
      <span className={ styles.debug_breakpoints_description }>{ data.description }</span>
    </div>
    {
      isDebugBreakpoint(data.breakpoint) ?
        isRuntimeBreakpoint(data.breakpoint) ?
          <Badge>
            {
              status && (status.column
                ? `${status.line}:${status.column}`
                : status.line)
            }
          </Badge> :
          <Badge>{ (data.breakpoint as DebugBreakpoint).raw.line }</Badge>
        : null
    }
  </div>;
};
