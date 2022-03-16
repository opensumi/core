import clsx from 'classnames';
import React from 'react';

import { IEventBus } from '@opensumi/ide-core-common';

import { ResizeEvent } from '../../layout';
import { useInjectable } from '../../react-hooks';
import { IResizeHandleDelegate, ResizeFlexMode } from '../resize/resize';

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
  direction?: Layout.direction;
  id: string;
  // setAbsoluteSize 时保证相邻节点总宽度不变
  resizeKeep?: boolean;
  dynamicTarget?: boolean;
  // 控制使用传入尺寸之和作为总尺寸或使用dom尺寸
  useDomSize?: boolean;
}

const getProp = (child: React.ReactNode, prop: string) => child && child['props'] && child['props'][prop];

export const SplitPanel: React.FC<SplitPanelProps> = ({
  id,
  className,
  children = [],
  direction = 'left-to-right',
  resizeKeep = true,
  flexGrow,
  dynamicTarget,
  minResize,
  useDomSize,
  ...restProps
}) => {
  const ResizeHandle = Layout.getResizeHandle(direction);
  // convert children to list
  const childList = React.Children.toArray(children);
  const totalFlexNum = childList.reduce(
    (accumulator, item) => accumulator + (getProp(item, 'flex') !== undefined ? item['props'].flex : 1),
    0,
  );
  const elements: React.ReactNodeArray = [];
  const resizeDelegates = React.useRef<IResizeHandleDelegate[]>([]);
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const rootRef = React.useRef<HTMLElement>();

  const splitPanelService = useInjectable<SplitPanelManager>(SplitPanelManager).getService(id);
  const maxLockState = React.useRef(childList.map(() => false));
  const hideState = React.useRef(childList.map(() => false));
  const resizeLockState = React.useRef(maxLockState.current.slice(0, childList.length - 1));
  const [locks, setLocks] = React.useState<boolean[]>(resizeLockState.current);
  const [hides, setHides] = React.useState<boolean[]>(hideState.current);
  const [maxLocks, setMaxLocks] = React.useState<boolean[]>(maxLockState.current);
  splitPanelService.panels = [];

  // 获取setSize的handle，对于最右端或最底部的视图，取上一个位置的handle
  const setSizeHandle = (index) => (size?: number, isLatter?: boolean) => {
    const targetIndex = isLatter ? index - 1 : index;
    const delegete = resizeDelegates.current[targetIndex];
    if (delegete) {
      delegete.setAbsoluteSize(
        size !== undefined ? size : getProp(childList[index], 'defaultSize'),
        isLatter,
        resizeKeep,
      );
    }
  };

  const setRelativeSizeHandle = (index) => (prev: number, next: number, isLatter?: boolean) => {
    const targetIndex = isLatter ? index - 1 : index;
    const delegete = resizeDelegates.current[targetIndex];
    if (delegete) {
      delegete.setRelativeSize(prev, next);
    }
  };

  const getSizeHandle = (index) => (isLatter?: boolean) => {
    const targetIndex = isLatter ? index - 1 : index;
    const delegete = resizeDelegates.current[targetIndex];
    if (delegete) {
      return delegete.getAbsoluteSize(isLatter);
    }
    return 0;
  };

  const getRelativeSizeHandle = (index) => (isLatter?: boolean) => {
    const targetIndex = isLatter ? index - 1 : index;
    const delegete = resizeDelegates.current[targetIndex];
    if (delegete) {
      return delegete.getRelativeSize();
    }
    return [0, 0];
  };

  const lockResizeHandle = (index) => (lock: boolean | undefined, isLatter?: boolean) => {
    const targetIndex = isLatter ? index - 1 : index;
    const newResizeState = resizeLockState.current.map((state, idx) =>
      idx === targetIndex ? (lock !== undefined ? lock : !state) : state,
    );
    resizeLockState.current = newResizeState;
    setLocks(newResizeState);
  };

  const setMaxSizeHandle = (index) => (lock: boolean | undefined, isLatter?: boolean) => {
    const newMaxState = maxLockState.current.map((state, idx) =>
      idx === index ? (lock !== undefined ? lock : !state) : state,
    );
    maxLockState.current = newMaxState;
    setMaxLocks(newMaxState);
  };

  const hidePanelHandle = (index: number) => (show?: boolean) => {
    const newHideState = hideState.current.map((state, idx) =>
      idx === index ? (show !== undefined ? !show : !state) : state,
    );
    hideState.current = newHideState;
    const location = getProp(childList[index], 'slot') || getProp(childList[index], 'id');
    if (location) {
      fireResizeEvent(location);
    }
    setHides(newHideState);
  };

  const fireResizeEvent = (location?: string) => {
    if (location) {
      eventBus.fire(new ResizeEvent({ slotLocation: location }));
    }
  };

  childList.forEach((element, index) => {
    if (index !== 0) {
      const targetElement = index === 1 ? childList[index - 1] : childList[index];
      let flexMode: ResizeFlexMode | undefined;
      if (getProp(element, 'flexGrow')) {
        flexMode = ResizeFlexMode.Prev;
      } else if (getProp(childList[index - 1], 'flexGrow')) {
        flexMode = ResizeFlexMode.Next;
      }
      const noResize = getProp(targetElement, 'noResize') || locks[index - 1];
      if (!noResize) {
        elements.push(
          <ResizeHandle
            onResize={(prev, next) => {
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
    elements.push(
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
          ref={(ele) => {
            if (ele && splitPanelService.panels.indexOf(ele) === -1) {
              splitPanelService.panels.push(ele);
            }
          }}
          id={getProp(element, 'id') /* @deprecated: query by data-view-id */}
          style={{
            // 手风琴场景，固定尺寸和flex尺寸混合布局；需要在resize flex模式下禁用
            ...(element['props'].flex &&
            !element['props'].savedSize &&
            !childList.find((item) => item!['props'].flexGrow)
              ? { flex: element['props'].flex }
              : { [Layout.getSizeProperty(direction)]: getElementSize(element) }),
            // 相对尺寸带来的问题，必须限制最小最大尺寸
            [Layout.getMinSizeProperty(direction)]: getProp(element, 'minSize')
              ? element['props'].minSize + 'px'
              : '-1px',
            [Layout.getMaxSizeProperty(direction)]:
              maxLocks[index] && getProp(element, 'minSize') ? element['props'].minSize + 'px' : 'unset',
            // resize flex模式下应用flexGrow
            ...(getProp(element, 'flexGrow') !== undefined ? { flexGrow: element['props'].flexGrow } : {}),
            display: hides[index] ? 'none' : 'block',
          }}
        >
          {element}
        </div>
      </PanelContext.Provider>,
    );
  });

  function getElementSize(element: any) {
    if (element.props.savedSize) {
      return element.props.savedSize + 'px';
    } else if (element.props.defaultSize !== undefined) {
      return element.props.defaultSize + 'px';
    } else if (element.props.flex) {
      return (element.props.flex / totalFlexNum) * 100 + '%';
    } else {
      return (1 / totalFlexNum) * 100 + '%';
    }
  }

  React.useEffect(() => {
    if (rootRef.current) {
      splitPanelService.rootNode = rootRef.current;
    }
    const disposer = eventBus.on(ResizeEvent, (e) => {
      if (e.payload.slotLocation === id) {
        childList.forEach((c) => {
          fireResizeEvent(getProp(c, 'slot') || getProp(c, 'id'));
        });
      }
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  return (
    <div
      ref={(ele) => (rootRef.current = ele!)}
      {...restProps}
      className={clsx(styles['split-panel'], className)}
      style={{ flexDirection: Layout.getFlexDirection(direction) }}
    >
      {elements}
    </div>
  );
};
