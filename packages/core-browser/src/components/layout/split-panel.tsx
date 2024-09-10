import cls from 'classnames';
import React from 'react';

import { IEventBus } from '@opensumi/ide-core-common';

import { ResizeEvent } from '../../layout';
import { useInjectable } from '../../react-hooks';
import { IResizeHandleDelegate, RESIZE_LOCK, ResizeFlexMode } from '../resize/resize';

import { Layout } from './layout';
import { SplitPanelManager } from './split-panel.service';
import styles from './styles.module.less';

export interface ResizeHandle {
  setSize: (targetSize?: number, isLatter?: boolean) => void;
  setRelativeSize: (prev: number, next: number, isLatter: boolean) => void;
  getSize: (isLatter: boolean) => number;
  getRelativeSize: (isLatter: boolean) => number[];
  lockSize: (lock: boolean | undefined, isLatter: boolean) => void;
  setMaxSize: (lock: boolean | undefined, isLatter: boolean) => void;
  hidePanel: (show?: boolean) => void;
}

export const PanelContext = React.createContext<ResizeHandle>({
  setSize: (targetSize: number, isLatter: boolean) => {},
  setRelativeSize: (prev, next, isLatter) => {},
  getSize: (isLatter: boolean) => 0,
  getRelativeSize: (isLatter: boolean) => [0, 0],
  lockSize: (lock: boolean | undefined, isLatter: boolean) => {},
  setMaxSize: (lock: boolean | undefined, isLatter: boolean) => {},
  hidePanel: (show?: boolean) => {},
});

type ChildComponent = React.ReactElement<SplitChildProps>;

/**
 * 推荐使用 `data-sp-` 方式来传递这些参数。
 *
 * 如：
 *
 * ```tsx
 * <SplitPanel>
 *   <div data-sp-id="div1" data-sp-minResize={100}></div>
 *   <div></div>
 * </SplitPanel>
 * ```
 */
interface SplitChildProps {
  id: string;
  minSize?: number;
  maxSize?: number;
  minResize?: number;
  flex?: number;
  overflow?: string;
  flexGrow?: number;
  slot?: string;
  noResize?: boolean;
  savedSize?: number;
  defaultSize?: number;
  children?: ChildComponent | ChildComponent[];
}

export interface SplitPanelProps extends SplitChildProps {
  className?: string;
  style?: React.CSSProperties;
  direction?: Layout.direction;
  headerSize?: number;
  id: string;
  // setAbsoluteSize 时保证相邻节点总宽度不变
  resizeKeep?: boolean;
  dynamicTarget?: boolean;
  /**
   * ResizeHandle 的 className，用以展示分割线等
   */
  resizeHandleClassName?: string;
}

const getProp = (child: React.ReactNode, prop: string, defaultValue?: any) =>
  (child && child['props'] && (child['props'][prop] ?? child['props'][`data-sp-${prop}`])) ?? defaultValue;

function getElementSize(element: any, totalFlexNum: number) {
  if (getProp(element, 'savedSize')) {
    return getProp(element, 'savedSize') + 'px';
  } else if (getProp(element, 'defaultSize') !== undefined) {
    return getProp(element, 'defaultSize') + 'px';
  } else if (getProp(element, 'flex')) {
    return (getProp(element, 'flex') / totalFlexNum) * 100 + '%';
  } else {
    return (1 / totalFlexNum) * 100 + '%';
  }
}

export const SplitPanel: React.FC<SplitPanelProps> = (props) => {
  const splitPanelService = useInjectable<SplitPanelManager>(SplitPanelManager).getService(props.id);

  const {
    id,
    className,
    headerSize,
    resizeHandleClassName,
    style,
    children = [],
    direction = 'left-to-right',
    resizeKeep = true,
    dynamicTarget,
  } = React.useMemo(
    () => splitPanelService.interceptProps(props),
    [splitPanelService, splitPanelService.interceptProps, props],
  );

  const ResizeHandle = Layout.getResizeHandle(direction);
  const flexStyleProperties = Layout.getStyleProperties(direction);

  const childList = React.useMemo(() => React.Children.toArray(children), [children]);

  const hasFlexGrow = React.useMemo(() => childList.find((item) => getProp(item, 'flexGrow')), [childList]);

  const totalFlexNum = React.useMemo(
    () => childList.reduce((accumulator, item) => accumulator + getProp(item, 'flex', 1), 0),
    [childList],
  );
  const resizeDelegates = React.useRef<IResizeHandleDelegate[]>([]);
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const rootRef = React.useRef<HTMLElement>();

  const maxLockState = React.useRef(childList.map(() => false));
  const hideState = React.useRef(childList.map(() => false));
  const resizeLockState = React.useRef(maxLockState.current.slice(0, childList.length - 1));
  const [locks, setLocks] = React.useState<boolean[]>(resizeLockState.current);
  const [hides, setHides] = React.useState<boolean[]>(hideState.current);
  const [maxLocks, setMaxLocks] = React.useState<boolean[]>(maxLockState.current);
  splitPanelService.panels = [];

  // 获取 setSize 的handle，对于最右端或最底部的视图，取上一个位置的 handle
  const setSizeHandle = React.useCallback(
    (index) => (size?: number, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegate = resizeDelegates.current[targetIndex];
      if (delegate) {
        delegate.setAbsoluteSize(
          size !== undefined ? size : getProp(childList[index], 'defaultSize'),
          isLatter,
          resizeKeep,
        );
      }
    },
    [resizeDelegates.current],
  );

  const setRelativeSizeHandle = React.useCallback(
    (index) => (prev: number, next: number, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegate = resizeDelegates.current[targetIndex];
      if (delegate) {
        delegate.setRelativeSize(prev, next);
      }
    },
    [resizeDelegates.current],
  );

  const getSizeHandle = React.useCallback(
    (index) => (isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegate = resizeDelegates.current[targetIndex];
      if (delegate) {
        return delegate.getAbsoluteSize(isLatter);
      }
      return 0;
    },
    [resizeDelegates.current],
  );

  const getRelativeSizeHandle = React.useCallback(
    (index) => (isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegate = resizeDelegates.current[targetIndex];
      if (delegate) {
        return delegate.getRelativeSize();
      }
      return [0, 0];
    },
    [resizeDelegates.current],
  );

  const lockResizeHandle = React.useCallback(
    (index) => (lock: boolean | undefined, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const newResizeState = resizeLockState.current.map((state, idx) =>
        idx === targetIndex ? (lock !== undefined ? lock : !state) : state,
      );
      resizeLockState.current = newResizeState;
      setLocks(newResizeState);
    },
    [resizeDelegates.current],
  );

  const setMaxSizeHandle = React.useCallback(
    (index) => (lock: boolean | undefined) => {
      const newMaxState = maxLockState.current.map((state, idx) =>
        idx === index ? (lock !== undefined ? lock : !state) : state,
      );
      maxLockState.current = newMaxState;
      setMaxLocks(newMaxState);
    },
    [resizeDelegates.current],
  );

  const hidePanelHandle = React.useCallback(
    (index: number) => (show?: boolean) => {
      const newHideState = hideState.current.map((state, idx) =>
        idx === index ? (show !== undefined ? !show : !state) : state,
      );
      hideState.current = newHideState;
      const location = getProp(childList[index], 'slot') || getProp(childList[index], 'id');
      if (location) {
        fireResizeEvent(location);
      }
      setHides(newHideState);
    },
    [childList, hideState.current],
  );

  const fireResizeEvent = React.useCallback(
    (location?: string) => {
      if (location) {
        eventBus.fire(new ResizeEvent({ slotLocation: location }));
        eventBus.fireDirective(ResizeEvent.createDirective(location));
      }
    },
    [eventBus],
  );

  const elements: React.ReactNode[] = React.useMemo(
    () =>
      childList
        .map((element, index) => {
          const result: JSX.Element[] = [];

          const propMinSize = getProp(element, 'minSize');
          const propMaxSize = getProp(element, 'maxSize');
          const propFlexGrow = getProp(element, 'flexGrow');

          if (index !== 0) {
            const targetElement = index === 1 ? childList[index - 1] : childList[index];
            let flexMode: ResizeFlexMode | undefined;
            if (propFlexGrow) {
              flexMode = ResizeFlexMode.Prev;
            } else if (getProp(childList[index - 1], 'flexGrow')) {
              flexMode = ResizeFlexMode.Next;
            }
            const noResize = getProp(targetElement, 'noResize') || locks[index - 1];
            if (!noResize) {
              result.push(
                <ResizeHandle
                  className={resizeHandleClassName}
                  onResize={() => {
                    const prevLocation = getProp(childList[index - 1], 'slot') || getProp(childList[index - 1], 'id');
                    const nextLocation = getProp(childList[index], 'slot') || getProp(childList[index], 'id');
                    fireResizeEvent(prevLocation!);
                    fireResizeEvent(nextLocation!);
                  }}
                  noColor={true}
                  findNextElement={
                    dynamicTarget
                      ? (direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction)
                      : undefined
                  }
                  findPrevElement={
                    dynamicTarget
                      ? (direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction, true)
                      : undefined
                  }
                  key={`split-handle-${index}`}
                  delegate={(delegate) => {
                    resizeDelegates.current.push(delegate);
                  }}
                  flexMode={flexMode}
                />,
              );
            }
          }

          result.push(
            <PanelContext.Provider
              key={index}
              value={{
                setSize: setSizeHandle(index),
                getSize: getSizeHandle(index),
                setRelativeSize: setRelativeSizeHandle(index),
                getRelativeSize: getRelativeSizeHandle(index),
                lockSize: lockResizeHandle(index),
                setMaxSize: setMaxSizeHandle(index),
                hidePanel: hidePanelHandle(index),
              }}
            >
              <div
                data-min-resize={getProp(element, 'minResize')}
                data-max-resize={getProp(element, 'maxResize')}
                ref={(ele) => {
                  if (ele && splitPanelService.panels.indexOf(ele) === -1) {
                    splitPanelService.panels.push(ele);
                  }
                }}
                className={getElementSize(element, totalFlexNum) === `${headerSize}px` ? RESIZE_LOCK : ''}
                id={getProp(element, 'id') /* @deprecated: query by data-view-id */}
                style={{
                  // 手风琴场景，固定尺寸和 flex 尺寸混合布局；需要在 Resize Flex 模式下禁用
                  ...(getProp(element, 'flex') && !getProp(element, 'savedSize') && !hasFlexGrow
                    ? { flex: getProp(element, 'flex') }
                    : { [flexStyleProperties.size]: getElementSize(element, totalFlexNum) }),
                  // 相对尺寸带来的问题，必须限制最小最大尺寸
                  [flexStyleProperties.minSize]: propMinSize ? propMinSize + 'px' : '-1px',
                  [flexStyleProperties.maxSize]: maxLocks[index] && propMaxSize ? propMaxSize + 'px' : 'unset',
                  // Resize Flex 模式下应用 flexGrow
                  ...(propFlexGrow !== undefined ? { flexGrow: propFlexGrow } : {}),
                  display: hides[index] ? 'none' : 'block',
                }}
              >
                {element}
              </div>
            </PanelContext.Provider>,
          );
          return result;
        })
        .filter(Boolean),
    [children, childList, resizeHandleClassName, dynamicTarget, resizeDelegates.current, hides, locks],
  );

  React.useEffect(() => {
    if (rootRef.current) {
      splitPanelService.setRootNode(rootRef.current);
    }
    const disposer = eventBus.onDirective(ResizeEvent.createDirective(id), () => {
      childList.forEach((c) => {
        fireResizeEvent(getProp(c, 'slot') || getProp(c, 'id'));
      });
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  const renderSplitPanel = React.useMemo(() => {
    const { minResize, flexGrow, minSize, maxSize, savedSize, defaultSize, flex, noResize, slot, headerSize, ...rest } =
      props;

    delete rest['resizeHandleClassName'];
    delete rest['dynamicTarget'];
    delete rest['resizeKeep'];
    delete rest['direction'];

    return splitPanelService.renderSplitPanel(
      <div
        {...rest}
        ref={(ele) => (rootRef.current = ele!)}
        className={cls(styles['split-panel'], className)}
        style={{ flexDirection: flexStyleProperties.direction, ...style }}
        data-min-resize={minResize}
        data-max-resize={maxSize}
        data-min-size={minSize}
        data-max-size={maxSize}
        data-saved-size={savedSize}
        data-default-size={defaultSize}
        data-header-size={headerSize}
        data-flex={flex}
        data-flex-grow={flexGrow}
        data-no-resize={noResize}
        data-slot={slot}
      />,
      elements,
      rest,
    );
  }, [splitPanelService, splitPanelService.renderSplitPanel, elements, rootRef, style, props]);

  return renderSplitPanel;
};
