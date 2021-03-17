import * as React from 'react';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugBreakpointsService } from './debug-breakpoints.service';
import { useInjectable, ViewState, CommandService, EDITOR_COMMANDS, URI } from '@ali/ide-core-browser';
import * as styles from './debug-breakpoints.module.less';
import * as cls from 'classnames';
import { CheckBox } from '@ali/ide-components';
import { observer } from 'mobx-react-lite';
import { DebugBreakpoint, DebugExceptionBreakpoint, isDebugBreakpoint, isRuntimeBreakpoint, getStatus, ISourceBreakpoint } from '../../breakpoint';
import { Badge, RecycleList } from '@ali/ide-components';
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

  const getBreakpointIcon = () => {
    const { className } = debugBreakpointsService.getBreakpointDecoration(data.breakpoint as DebugBreakpoint, isDebugMode, enabled);
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

  return <div className={ cls(styles.debug_breakpoints_item) }>
    <div className={ cls(converBreakpointClsState(), styles.debug_breakpoints_icon) }></div>
    <CheckBox id={ data.id } defaultChecked={ enabled } onChange={ handleBreakpointChange }></CheckBox>
    <div className={ styles.debug_breakpoints_wrapper } onClick={ handleBreakpointClick }>
      <span className={ styles.debug_breakpoints_name }>{ data.name }</span>
      <span className={ styles.debug_breakpoints_description }>{ data.description }</span>
    </div>
    {
      isDebugBreakpoint(data.breakpoint) ? (
        <Badge>
          { (data.breakpoint as DebugBreakpoint).raw.line }
          { data.breakpoint.raw.column && `:${data.breakpoint.raw.column}` }
        </Badge>
      ) : null
    }
  </div>;
};
