import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BasicRecycleTree, CheckBox, IBasicTreeData, ICompositeTreeNode } from '@opensumi/ide-components';
import { Badge } from '@opensumi/ide-components';
import {
  useInjectable,
  CommandService,
  EDITOR_COMMANDS,
  URI,
  getIcon,
  Disposable,
  ViewState,
  Event,
  isUndefined,
} from '@opensumi/ide-core-browser';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { IDebugBreakpoint, IDebugSessionManager, ISourceBreakpoint } from '../../../common';
import {
  DebugExceptionBreakpoint,
  isDebugBreakpoint,
  isRuntimeBreakpoint,
  getStatus,
  isDebugExceptionBreakpoint,
  EXCEPTION_BREAKPOINT_URI,
} from '../../breakpoint';
import { DebugSessionManager } from '../../debug-session-manager';

import { BreakpointsTreeNode } from './debug-breakpoints-tree.model';
import styles from './debug-breakpoints.module.less';
import { DebugBreakpointsService } from './debug-breakpoints.service';

export interface BreakpointItem {
  name: string;
  id: string;
  description: string;
  onDescriptionChange: Event<string>;
  breakpoint: IDebugBreakpoint | DebugExceptionBreakpoint;
}

export const DebugBreakpointView = observer(({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const debugBreakpointsService: DebugBreakpointsService = useInjectable(DebugBreakpointsService);
  const { enable, toggleBreakpointEnable } = debugBreakpointsService;
  const isDisposed = useRef<boolean>(false);
  const [treeData, setTreeData] = useState<IBasicTreeData[]>([]);

  const updateTreeData = useCallback(
    (nodes: [string, BreakpointsTreeNode[]][]) => {
      const { roots } = debugBreakpointsService;
      const breakpointTreeData: IBasicTreeData[] = [];
      nodes.forEach(([uri, items]) => {
        const isException = EXCEPTION_BREAKPOINT_URI.toString() === uri;
        if (isException) {
          items.forEach((item) => {
            breakpointTreeData.push({
              label: '',
              expandable: false,
              children: [],
              description: (
                <BreakpointItem
                  toggle={() => toggleBreakpointEnable(item.breakpoint)}
                  breakpointEnabled={enable}
                  data={item.rawData}
                  isDebugMode={debugBreakpointsService.inDebugMode}
                ></BreakpointItem>
              ),
            });
          });
        } else {
          const toURI = URI.parse(uri);
          const parent = roots.filter((root) => root.isEqualOrParent(toURI))[0];

          breakpointTreeData.push({
            label: parent ? parent.relative(toURI)?.toString() || '' : URI.parse(uri).displayName,
            expandable: true,
            iconClassName: cls(getIcon('file-text'), ''),
            expanded: true,
            children: items.map((item) => ({
              ...item,
              label: '',
              expandable: false,
              doNotUseExpandablePlaceholder: true,
              description: (
                <BreakpointItem
                  toggle={() => toggleBreakpointEnable(item.breakpoint)}
                  breakpointEnabled={enable}
                  data={item.rawData}
                  isDebugMode={debugBreakpointsService.inDebugMode}
                ></BreakpointItem>
              ),
            })),
          });
        }
      });
      if (!isDisposed.current) {
        setTreeData(breakpointTreeData);
      }
    },
    [treeData],
  );

  useEffect(() => {
    const dispose = new Disposable();
    updateTreeData(Array.from(debugBreakpointsService.treeNodeMap.entries()));
    dispose.addDispose(
      debugBreakpointsService.onDidChangeBreakpointsTreeNode((nodes: Map<string, BreakpointsTreeNode[]>) => {
        updateTreeData(Array.from(nodes.entries()));
      }),
    );

    return () => {
      isDisposed.current = true;
      dispose.dispose();
    };
  }, []);

  useEffect(() => {
    if (treeData.length > 0) {
      requestAnimationFrame(() => {
        debugBreakpointsService.refreshBreakpointsInfo();
      });
    }
  }, [treeData]);

  const getItemClassName = useCallback((item: ICompositeTreeNode) => {
    if (!item.children && isUndefined((item as any).expandable)) {
      return styles.debug_breakpoints_item_tree_node;
    }
  }, []);
  return (
    <div className={cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled)}>
      <BasicRecycleTree treeData={treeData} height={viewState.height} getItemClassName={getItemClassName} />
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
  const [description, setDescription] = React.useState<string>(data.description);

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
    const disposable = new Disposable();

    const exec = () => {
      if (isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint)) {
        const status = getStatus(data.breakpoint);
        setStatus(status);
      }
    };

    disposable.addDispose(manager.onDidChangeActiveDebugSession(() => exec()));
    exec();

    disposable.addDispose(data.onDescriptionChange(setDescription));

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

  const isExceptionBreakpoint = useMemo(() => isDebugExceptionBreakpoint(data.breakpoint), [data]);

  return (
    <div className={cls(styles.debug_breakpoints_item)}>
      {!isExceptionBreakpoint && (
        <div
          onClick={handleBreakpointChange}
          className={cls(converBreakpointClsState(), styles.debug_breakpoints_icon)}
        ></div>
      )}
      <CheckBox
        className={styles.debug_breakpoints_icon}
        id={data.id}
        onChange={handleBreakpointChange}
        checked={enabled}
      ></CheckBox>
      <div className={styles.debug_breakpoints_wrapper} onClick={handleBreakpointClick}>
        {data.name && <span className={styles.debug_breakpoints_name}>{data.name}</span>}
        <span className={styles.debug_breakpoints_description}>{description}</span>
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
