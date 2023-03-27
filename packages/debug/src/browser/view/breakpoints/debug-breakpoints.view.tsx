import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BasicRecycleTree, CheckBox, IBasicTreeData } from '@opensumi/ide-components';
import { Badge } from '@opensumi/ide-components';
import { useInjectable, CommandService, EDITOR_COMMANDS, URI, getIcon, Disposable, ViewState } from '@opensumi/ide-core-browser';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { IDebugBreakpoint, IDebugSessionManager, ISourceBreakpoint } from '../../../common';
import { DebugExceptionBreakpoint, isDebugBreakpoint, isRuntimeBreakpoint, getStatus, BreakpointManager, isDebugExceptionBreakpoint } from '../../breakpoint';
import { DebugSessionManager } from '../../debug-session-manager';

import styles from './debug-breakpoints.module.less';
import { DebugBreakpointsService } from './debug-breakpoints.service';

export interface BreakpointItem {
  name: string;
  id: string;
  description: string;
  breakpoint: IDebugBreakpoint | DebugExceptionBreakpoint;
}

export const DebugBreakpointView = observer(({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const { nodes, enable, inDebugMode, toggleBreakpointEnable }: DebugBreakpointsService =
    useInjectable(DebugBreakpointsService);

  const treeData = React.useMemo(() => {
    const breakpointTreeData: IBasicTreeData[] = [];
    const exceptionBreakpoints = nodes.filter(node => isDebugExceptionBreakpoint(node.breakpoint));
    const excludeExceptionBreakpoints = nodes.filter(node => isDebugBreakpoint(node.breakpoint));

    if (exceptionBreakpoints.length > 0) {
      exceptionBreakpoints.forEach(item => {
        breakpointTreeData.push({
          id: item.id,
          label: '',
          description: <BreakpointItem
            toggle={() => toggleBreakpointEnable(item.breakpoint)}
            breakpointEnabled={enable}
            data={item}
            isDebugMode={inDebugMode}
          ></BreakpointItem>,
          expandable: false,
          children: [],
        });
      })
    }

    const groupByUri: Record<string, BreakpointItem[]> = excludeExceptionBreakpoints.reduce((acc, cur) => {
      const uri = (cur.breakpoint as ISourceBreakpoint).uri;
      if (!acc[uri]) {
        acc[uri] = [];
      }
      acc[uri].push(cur);
      return acc;
    }, {} as Record<string, BreakpointItem[]>);

    for (const uri in groupByUri) {
      const toURI = new URI(uri);

      breakpointTreeData.push({
        id: toURI.toString(),
        name: toURI.displayName,
        label: toURI.displayName,
        expandable: true,
        children: groupByUri[uri].map(item => ({
          label: '',
          id: item.id,
          name: '',
          description: <BreakpointItem
            toggle={() => toggleBreakpointEnable(item.breakpoint)}
            breakpointEnabled={enable}
            data={item}
            isDebugMode={inDebugMode}
          ></BreakpointItem>,
          rawData: item,
        })),
      });
    };
    return breakpointTreeData;
  }, [nodes]);

  const resolveTestChildren = React.useCallback((node?: any) => {
    if (!node) {
      return null;
    }
    if (node.children && node.children.length > 0) {
      return node.children;
    }
    return [];
  }, []);

  return (
    <div className={cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled)}>
      <BasicRecycleTree treeData={treeData} height={viewState.height} resolveChildren={resolveTestChildren} />
    </div>
  );
});

export const BreakpointItem = ({
  data,
  toggle,
  isDebugMode,
  breakpointEnabled,
}: {
  data: BreakpointItem;
  toggle: () => void;
  isDebugMode: boolean;
  breakpointEnabled: boolean;
}) => {
  const defaultValue = isDebugBreakpoint(data.breakpoint) ? data.breakpoint.enabled : !!data.breakpoint.default;
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
      if (status) {
        options['range'] = {
          startColumn: status.column || 0,
          endColumn: status.column || 0,
          startLineNumber: status.line,
          endLineNumber: status.line,
        };
      } else {
        options['range'] = {
          startColumn: (data.breakpoint as IDebugBreakpoint).raw.column || 0,
          endColumn: (data.breakpoint as IDebugBreakpoint).raw.column || 0,
          startLineNumber: (data.breakpoint as IDebugBreakpoint).raw.line,
          endLineNumber: (data.breakpoint as IDebugBreakpoint).raw.line,
        };
      }
      commandService.executeCommand(
        EDITOR_COMMANDS.OPEN_RESOURCE.id,
        new URI((data.breakpoint as ISourceBreakpoint).uri),
        options,
      );
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

  const verified = !isDebugMode ? true : isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint);

  const getBreakpointIcon = () => {
    const { className } = debugBreakpointsService.getBreakpointDecoration(
      data.breakpoint as IDebugBreakpoint,
      isDebugMode,
      breakpointEnabled && enabled,
    );
    return className;
  };

  const converBreakpointClsState = () => {
    if (isDebugBreakpoint(data.breakpoint)) {
      if (!verified) {
        return 'sumi-debug-breakpoint-unverified';
      }

      return getBreakpointIcon();
    }

    return '';
  };

  const removeBreakpoint = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.stopPropagation();
    debugBreakpointsService.delBreakpoint(data.breakpoint as IDebugBreakpoint);
  };

  const isExceptionBreakpoint = useMemo(() => {
    return isDebugExceptionBreakpoint(data.breakpoint)
  }, [data])

  return (
    <div className={cls(styles.debug_breakpoints_item)}>
      { !isExceptionBreakpoint && <div className={cls(converBreakpointClsState(), styles.debug_breakpoints_icon)}></div> }
      <CheckBox id={data.id} onChange={handleBreakpointChange} checked={enabled}></CheckBox>
      <div className={styles.debug_breakpoints_wrapper} onClick={handleBreakpointClick}>
        <span className={styles.debug_breakpoints_name}>{data.name}</span>
        <span className={styles.debug_breakpoints_description}>{data.description}</span>
      </div>
      {isDebugBreakpoint(data.breakpoint) ? (
        <>
          <a
            title='删除断点'
            onClick={(event) => removeBreakpoint(event)}
            className={cls(styles.debug_remove_breakpoints_icon, getIcon('close'))}
          ></a>
          <Badge className={styles.debug_breakpoints_badge}>
            {(data.breakpoint as IDebugBreakpoint).raw.line}
            {!!data.breakpoint.raw.column && `:${data.breakpoint.raw.column}`}
          </Badge>
        </>
      ) : null}
    </div>
  );
};
