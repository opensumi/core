import React from 'react';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';
import { DebugBreakpointsService } from './debug-breakpoints.service';
import { useInjectable, ViewState, CommandService, EDITOR_COMMANDS, URI, getIcon } from '@opensumi/ide-core-browser';
import styles from './debug-breakpoints.module.less';
import cls from 'classnames';
import { CheckBox } from '@opensumi/ide-components';
import { observer } from 'mobx-react-lite';
import { DebugBreakpoint, DebugExceptionBreakpoint, isDebugBreakpoint, isRuntimeBreakpoint, getStatus, ISourceBreakpoint } from '../../breakpoint';
import { Badge, RecycleList } from '@opensumi/ide-components';
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
    return <BreakpointItem toggle={ () => toggleBreakpointEnable(data.breakpoint) } breakpointEnabled={enable} data={ data } isDebugMode={ inDebugMode }></BreakpointItem>;
  };

  const containerStyle = {
    height: viewState.height,
    width: viewState.width,
  } as React.CSSProperties;

  return <div className={ cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled) }>
    <RecycleList
      data={ nodes }
      itemHeight={22}
      template={ template }
      style={ containerStyle }
    />
  </div>;
});

export const BreakpointItem = ({
  data,
  toggle,
  isDebugMode,
  breakpointEnabled,
}: {
  data: BreakpointItem,
  toggle: () => void,
  isDebugMode: boolean,
  breakpointEnabled: boolean,
}) => {
  const defaultValue = isDebugBreakpoint(data.breakpoint) ? data.breakpoint.enabled : !!(data.breakpoint.default);
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const commandService = useInjectable<CommandService>(CommandService);
  const debugBreakpointsService = useInjectable<DebugBreakpointsService>(DebugBreakpointsService);
  const [enabled, setEnabled] = React.useState<boolean>(defaultValue);
  const [status, setStatus] = React.useState<DebugProtocol.Breakpoint | false | undefined>(undefined);

  const handleBreakpointChange = () => {
    toggle();
    setEnabled(!enabled);
  };

  const handleBreakpointClick = () => {
    if ((data.breakpoint as ISourceBreakpoint).uri) {
      const options = {
        preview: true,
        focus: true,
      };
      if (!!status) {
        options['range'] = {
          startColumn: status.column || 0,
          endColumn: status.column || 0,
          startLineNumber: status.line,
          endLineNumber: status.line,
        };
      } else {
        options['range'] = {
          startColumn: (data.breakpoint as DebugBreakpoint).raw.column || 0,
          endColumn: (data.breakpoint as DebugBreakpoint).raw.column || 0,
          startLineNumber: (data.breakpoint as DebugBreakpoint).raw.line,
          endLineNumber: (data.breakpoint as DebugBreakpoint).raw.line,
        };
      }
      commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI((data.breakpoint as ISourceBreakpoint).uri), options);
    }
  };

  React.useEffect(() => {
    const exec = () => {
      if (isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint)) {
        const status = getStatus(data.breakpoint);
        setStatus(status);
      }
    };

    const disposable = manager.onDidChangeActiveDebugSession(() => exec());
    exec();

    return () => {
      setStatus(undefined);
      disposable.dispose();
    };
  }, []);

  const verified = !isDebugMode ? true : (isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint));

  const getBreakpointIcon = () => {
    const { className } = debugBreakpointsService.getBreakpointDecoration(data.breakpoint as DebugBreakpoint, isDebugMode, breakpointEnabled && enabled);
    return className;
  };

  const converBreakpointClsState = () => {
    if (isDebugBreakpoint(data.breakpoint)) {
      if (!verified) {
        return 'kaitian-debug-breakpoint-unverified';
      }

      return getBreakpointIcon();
    }

    return '';
  };

  const removeBreakpoint = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.stopPropagation();
    debugBreakpointsService.delBreakpoint(data.breakpoint as DebugBreakpoint);
  };

  return <div className={ cls(styles.debug_breakpoints_item) }>
    <div className={ cls(converBreakpointClsState(), styles.debug_breakpoints_icon) }></div>
    <CheckBox id={ data.id } onChange={ handleBreakpointChange } checked={ enabled }></CheckBox>
    <div className={ styles.debug_breakpoints_wrapper } onClick={ handleBreakpointClick }>
      <span className={ styles.debug_breakpoints_name }>{ data.name }</span>
      <span className={ styles.debug_breakpoints_description }>{ data.description }</span>
    </div>
    {
      isDebugBreakpoint(data.breakpoint) ? (
        <>
          <a
            title='删除断点'
            onClick={ (event) => removeBreakpoint(event) }
            className={ cls(styles.debug_remove_breakpoints_icon, getIcon('close'))} >
          </a>
          <Badge className={ styles.debug_breakpoints_badge }>
            { (data.breakpoint as DebugBreakpoint).raw.line }
            { !!data.breakpoint.raw.column && `:${data.breakpoint.raw.column}` }
          </Badge>
        </>
      ) : null
    }
  </div>;
};
