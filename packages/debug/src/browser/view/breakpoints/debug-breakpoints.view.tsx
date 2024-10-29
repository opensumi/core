import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge, BasicRecycleTree, CheckBox, IBasicTreeData } from '@opensumi/ide-components';
import {
  CommandService,
  Disposable,
  EDITOR_COMMANDS,
  Event,
  IRange,
  URI,
  ViewState,
  getExternalIcon,
  getIcon,
  localize,
  useAutorun,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { IResourceOpenOptions } from '@opensumi/ide-editor';
import * as monaco from '@opensumi/ide-monaco';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { DEBUG_COMMANDS, IDebugBreakpoint, IDebugSessionManager, ISourceBreakpoint } from '../../../common';
import {
  DebugExceptionBreakpoint,
  EXCEPTION_BREAKPOINT_URI,
  getStatus,
  isDebugBreakpoint,
  isRuntimeBreakpoint,
} from '../../breakpoint';
import { DebugSessionManager } from '../../debug-session-manager';

import { BreakpointsTreeNode } from './debug-breakpoints-tree.model';
import styles from './debug-breakpoints.module.less';
import { DebugBreakpointsService } from './debug-breakpoints.service';

interface IBreakpointTreeData extends IBasicTreeData {
  order?: number;
}

export interface BreakpointItem {
  name: string;
  id: string;
  description: string;
  onDescriptionChange: Event<string>;
  breakpoint: IDebugBreakpoint | DebugExceptionBreakpoint;
}

export const DebugBreakpointView = ({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const debugBreakpointsService: DebugBreakpointsService = useInjectable(DebugBreakpointsService);
  const isDisposed = useRef<boolean>(false);
  const [treeData, setTreeData] = useState<IBreakpointTreeData[]>([]);
  const { enable, inDebugMode, toggleBreakpointEnable } = debugBreakpointsService;
  const autorunEnable = useAutorun(enable);
  const autorunInDebugMode = useAutorun(inDebugMode);

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
      const breakpointTreeData: IBreakpointTreeData[] = [];
      nodes.forEach(([uri, items], index) => {
        const isException = EXCEPTION_BREAKPOINT_URI.toString() === uri;
        if (isException) {
          items.forEach((item, i) => {
            breakpointTreeData.push({
              label: '',
              order: index * 100 + i,
              expandable: false,
              twisterPlaceholderClassName: styles.tree_item_twister_placeholder_fill,
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
          const label = parent ? parent.relative(toURI)?.toString() || '' : URI.parse(uri).displayName;
          const breakpointItems = items.map((item) => item.breakpoint as IDebugBreakpoint);

          breakpointTreeData.push({
            label,
            order: index,
            twisterClassName: styles.tree_item_twister,
            renderLabel: (
              <BreakpointFileItem
                label={label}
                breakpointItems={breakpointItems}
                title={toURI.toString()}
              ></BreakpointFileItem>
            ),
            expandable: true,
            expanded: true,
            children: items.map((item) => ({
              ...item,
              label: '',
              expandable: false,
              twisterClassName: styles.tree_item_twister,
              twisterPlaceholderClassName: styles.tree_item_twister_placeholder,
              breakpoint: item.breakpoint,
              iconClassName: cls(
                getBreakpointClsState({
                  data: item.rawData,
                  inDebugMode: autorunInDebugMode,
                  breakpointEnabled: autorunEnable,
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
    <div className={cls(styles.debug_breakpoints, !autorunEnable && styles.debug_breakpoints_disabled)}>
      <BasicRecycleTree
        onIconClick={(_, item) => {
          if (item.raw.breakpoint) {
            toggleBreakpointEnable(item.raw.breakpoint);
          }
        }}
        sortComparator={(a: IBreakpointTreeData, b: IBreakpointTreeData) => {
          if (typeof a.order !== 'undefined' && typeof b.order !== 'undefined') {
            return a.order > b.order ? 1 : a.order < b.order ? -1 : 0;
          }
          return undefined;
        }}
        indent={18}
        baseIndent={8}
        treeData={treeData}
        height={viewState.height}
      />
    </div>
  );
};

interface BreakpointFileItemProps {
  label: string;
  breakpointItems: IDebugBreakpoint[];
  title?: string;
}

export const BreakpointFileItem = ({ label, title, breakpointItems }: BreakpointFileItemProps) => {
  const debugBreakpointsService: DebugBreakpointsService = useInjectable(DebugBreakpointsService);

  /**
   * 只要断点列表有一个是启用的，那么就认为是启用状态
   */
  const defaultEnabled = useMemo(() => breakpointItems.some((item) => item.enabled), [breakpointItems]);
  const [enabled, setEnabled] = React.useState<boolean>(defaultEnabled);

  const handleCheckBoxChange = useCallback(
    (preEnabled: boolean) => {
      const matchBreakpoints = breakpointItems.filter((item) => item.enabled === preEnabled);
      matchBreakpoints.forEach((breakpoint) => {
        debugBreakpointsService.toggleBreakpointEnable(breakpoint);
      });
      setEnabled(!enabled);
    },
    [enabled],
  );

  const removeBreakpoint = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    breakpointItems.forEach((breakpoint) => {
      debugBreakpointsService.delBreakpoint(breakpoint);
    });
  }, []);

  return (
    <div className={styles.debug_breakpoints_file_item}>
      <div className={styles.file_item_control}>
        <CheckBox
          className={cls(styles.debug_breakpoints_icon, styles.file_item_checkbox)}
          onChange={() => handleCheckBoxChange(enabled)}
          checked={enabled}
        ></CheckBox>
        <i className={cls(getIcon('file-text'), styles.file_item_icon, styles.debug_breakpoints_icon)}></i>
        <span title={title}>{label}</span>
      </div>
      <div className={styles.file_item_control_right}>
        <i className={cls(getIcon('close'), styles.close_icon)} onClick={(event) => removeBreakpoint(event)}></i>
      </div>
    </div>
  );
};

export const BreakpointItem = ({ data, toggle }: { data: BreakpointItem; toggle: () => void }) => {
  const defaultValue = isDebugBreakpoint(data.breakpoint) ? data.breakpoint.enabled : !!data.breakpoint.default;
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const commandService = useInjectable<CommandService>(CommandService);
  const debugBreakpointsService = useInjectable<DebugBreakpointsService>(DebugBreakpointsService);
  const [enabled, setEnabled] = React.useState<boolean>(defaultValue);
  const [status, setStatus] = React.useState<DebugProtocol.Breakpoint | false | undefined>(undefined);
  const [description, setDescription] = React.useState<string>(data.description);

  const openOptions = useMemo(() => {
    const options: IResourceOpenOptions = {
      preview: true,
      focus: true,
    };

    if (!isDebugBreakpoint(data.breakpoint)) {
      return options;
    }

    if (status) {
      options.range = {
        startColumn: status.column || 0,
        endColumn: status.column || 0,
        startLineNumber: status.line,
        endLineNumber: status.line,
      };
    } else {
      const { raw } = data.breakpoint as IDebugBreakpoint;
      options.range = {
        startColumn: raw.column || 0,
        endColumn: raw.column || 0,
        startLineNumber: raw.line,
        endLineNumber: raw.line,
      };
    }

    return options;
  }, [status, data.breakpoint]);

  const handleBreakpointChange = () => {
    toggle();
    setEnabled(!enabled);
  };

  const handleBreakpointClick = async () => {
    if ((data.breakpoint as ISourceBreakpoint).uri) {
      await commandService.executeCommand(
        EDITOR_COMMANDS.OPEN_RESOURCE.id,
        new URI((data.breakpoint as ISourceBreakpoint).uri),
        openOptions,
      );

      debugBreakpointsService.launchFocusedBreakpoints({
        uri: new URI((data.breakpoint as ISourceBreakpoint).uri),
        range: openOptions.range as IRange,
      });
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

  const removeBreakpoint = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.stopPropagation();
    debugBreakpointsService.delBreakpoint(data.breakpoint as IDebugBreakpoint);
  };

  const editBreakpoint = async (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.stopPropagation();

    await commandService.executeCommand(
      EDITOR_COMMANDS.OPEN_RESOURCE.id,
      new URI((data.breakpoint as ISourceBreakpoint).uri),
      openOptions,
    );

    const { range } = openOptions;

    const position = new monaco.Position(range?.startLineNumber || 1, range?.startColumn || 1);
    await commandService.executeCommand(DEBUG_COMMANDS.EDIT_BREAKPOINT.id, position);
  };

  const renderDescription = useMemo(() => {
    if (description) {
      return <span className={styles.debug_breakpoints_description}>{description}</span>;
    }

    if (!isDebugBreakpoint(data.breakpoint)) {
      return null;
    }

    return (
      <span className={cls(styles.debug_breakpoints_description, styles.blank)}>{`< ${localize(
        'debug.breakpoint.blank',
      )} >`}</span>
    );
  }, [description, data.breakpoint]);

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
        {renderDescription}
      </div>
      {isDebugBreakpoint(data.breakpoint) ? (
        <>
          <div className={styles.debug_breakpoints_item_control}>
            {openOptions.range && (
              <i
                title={localize('debug.menu.edit.breakpoint')}
                onClick={(event) => editBreakpoint(event)}
                className={cls(styles.debug_edit_breakpoints_icon, getExternalIcon('edit'))}
              ></i>
            )}
            <i
              title={localize('debug.menu.delete.breakpoint')}
              onClick={(event) => removeBreakpoint(event)}
              className={cls(styles.debug_remove_breakpoints_icon, getIcon('close'))}
            ></i>
          </div>
          <Badge className={styles.debug_breakpoints_badge}>
            {(data.breakpoint as IDebugBreakpoint).raw.line}
            {!!data.breakpoint.raw.column && `:${data.breakpoint.raw.column}`}
          </Badge>
        </>
      ) : null}
    </div>
  );
};
