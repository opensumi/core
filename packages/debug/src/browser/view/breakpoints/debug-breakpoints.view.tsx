import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { BasicRecycleTree, CheckBox, IBasicTreeData } from '@opensumi/ide-components';
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
} from '@opensumi/ide-core-browser';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { IDebugBreakpoint, IDebugSessionManager, ISourceBreakpoint } from '../../../common';
import {
  DebugExceptionBreakpoint,
  isDebugBreakpoint,
  isRuntimeBreakpoint,
  getStatus,
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

  const getBreakpointClsState = (options: {
    data: BreakpointItem;
    inDebugMode: boolean;
    breakpointEnabled: boolean;
  }) => {
    const { data, inDebugMode, breakpointEnabled } = options;
    if (isDebugBreakpoint(data.breakpoint)) {
      const verified = !inDebugMode ? true : isDebugBreakpoint(data.breakpoint) && isRuntimeBreakpoint(data.breakpoint);

      if (!verified) {
        return 'sumi-debug-breakpoint-unverified';
      }

      const { className } = debugBreakpointsService.getBreakpointDecoration(
        data.breakpoint as IDebugBreakpoint,
        inDebugMode,
        breakpointEnabled,
      );
      return className;
    }

    return '';
  };

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
                  data={item.rawData}
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
            iconClassName: getIcon('file-text'),
            expanded: true,
            children: items.map((item) => ({
              ...item,
              label: '',
              expandable: false,
              twisterPlaceholderClassName: styles.tree_item_twister_placeholder,
              breakpoint: item.breakpoint,
              iconClassName: cls(
                getBreakpointClsState({
                  data: item.rawData,
                  inDebugMode: debugBreakpointsService.inDebugMode,
                  breakpointEnabled: enable,
                }),
                styles.debug_breakpoints_icon,
              ),
              description: (
                <BreakpointItem
                  toggle={() => toggleBreakpointEnable(item.breakpoint)}
                  data={item.rawData}
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

  return (
    <div className={cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled)}>
      <BasicRecycleTree
        onIconClick={(_, item) => {
          if (item.raw.breakpoint) {
            toggleBreakpointEnable(item.raw.breakpoint);
          }
        }}
        indent={20}
        baseIndent={8}
        treeData={treeData}
        height={viewState.height}
      />
    </div>
  );
});

export const BreakpointItem = ({ data, toggle }: { data: BreakpointItem; toggle: () => void }) => {
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

  const removeBreakpoint = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.stopPropagation();
    debugBreakpointsService.delBreakpoint(data.breakpoint as IDebugBreakpoint);
  };

  return (
    <div className={cls(styles.debug_breakpoints_item)}>
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
