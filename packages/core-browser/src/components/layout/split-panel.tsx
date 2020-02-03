import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IResizeHandleDelegate, ResizeFlexMode } from '../resize/resize';
import { IEventBus } from '@ali/ide-core-common';
import { ResizeEvent } from '../../layout';
import { SplitPanelManager } from './split-panel.service';

export interface ResizeHandle {
  setSize: (targetSize: number, isLatter: boolean) => void;
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
  flexGrow?: number;
  slot?: string;
  noResize?: boolean;
  children?: ChildComponent | ChildComponent[];
}

interface SplitPanelProps extends SplitChildProps {
  className?: string;
  direction?: Layout.direction;
  id: string;
  // setAbsoluteSize 时保证相邻节点总宽度不变
  resizeKeep?: boolean;
  dynamicTarget?: boolean;
}

export const SplitPanel: React.FC<SplitPanelProps> = (({ id, className, children = [], direction = 'left-to-right', resizeKeep = true, flexGrow, dynamicTarget, minResize, ...restProps }) => {
  const ResizeHandle = Layout.getResizeHandle(direction);
  // convert children to list
  const childList = React.Children.toArray(children);
  const totalFlexNum = childList.reduce((accumulator, item) => accumulator + (item['props'] && (item['props'].flex !== undefined) ? item['props'].flex : 1), 0);
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
  // 获取setSize的handle，对于最右端或最底部的视图，取上一个位置的handle
  const setSizeHandle = (index) => {
    return (size: number, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegete = resizeDelegates.current[targetIndex];
      if (delegete) {
        delegete.setAbsoluteSize(size, isLatter, resizeKeep);
      }
    };
  };

  const setRelativeSizeHandle = (index) => {
    return (prev: number, next: number, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegete = resizeDelegates.current[targetIndex];
      if (delegete) {
        delegete.setRelativeSize(prev, next);
      }
    };
  };

  const getSizeHandle = (index) => {
    return (isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegete = resizeDelegates.current[targetIndex];
      if (delegete) {
        return delegete.getAbsoluteSize(isLatter);
      }
      return 0;
    };
  };

  const getRelativeSizeHandle = (index) => {
    return (isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const delegete = resizeDelegates.current[targetIndex];
      if (delegete) {
        return delegete.getRelativeSize();
      }
      return [0, 0];
    };
  };

  const lockResizeHandle = (index) => {
    return (lock: boolean | undefined, isLatter?: boolean) => {
      const targetIndex = isLatter ? index - 1 : index;
      const newResizeState = resizeLockState.current.map((state, idx) => idx === targetIndex ? (lock !== undefined ? lock : !state) : state);
      resizeLockState.current = newResizeState;
      setLocks(newResizeState);
    };
  };

  const setMaxSizeHandle = (index) => {
    return (lock: boolean | undefined, isLatter?: boolean) => {
      const newMaxState = maxLockState.current.map((state, idx) => idx === index ? (lock !== undefined ? lock : !state) : state);
      maxLockState.current = newMaxState;
      setMaxLocks(newMaxState);
    };
  };

  const hidePanelHandle = (index: number) => {
    return (show?: boolean) => {
      const newHideState = hideState.current.map((state, idx) => idx === index ? (show !== undefined ? !show : !state) : state);
      hideState.current = newHideState;
      setHides(newHideState);
    };
  };

  const fireResizeEvent = (location?: string) => {
    if (location) {
      eventBus.fire(new ResizeEvent({slotLocation: location}));
    }
  };

  childList.forEach((element, index) => {
    if (index !== 0) {
      const targetElement = index === 1 ? childList[index - 1] : childList[index];
      let flexMode: ResizeFlexMode | undefined;
      if (element['props'] && element['props'].flexGrow) {
        flexMode = ResizeFlexMode.Prev;
      } else if (childList[index - 1] && childList[index - 1]['props'] && childList[index - 1]['props'].flexGrow) {
        flexMode = ResizeFlexMode.Next;
      }
      elements.push(
        <ResizeHandle
          className={targetElement['props'] && targetElement['props'].noResize || locks[index - 1] ? 'no-resize' : ''}
          onResize={(prev, next) => {
            const prevLocation = childList[index - 1]['props'] && childList[index - 1]['props'].slot || childList[index - 1]['props'] && childList[index - 1]['props'].id;
            const nextLocation = childList[index]['props'] && childList[index]['props'].slot || childList[index]['props'] && childList[index]['props'].id;
            fireResizeEvent(prevLocation!);
            fireResizeEvent(nextLocation!);
          }}
          noColor={true}
          findNextElement={dynamicTarget ? (direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction) : undefined}
          findPrevElement={dynamicTarget ? (direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction, true) : undefined}
          key={`split-handle-${index}`}
          delegate={(delegate) => { resizeDelegates.current.push(delegate); }}
          flexMode={ flexMode }
          />,
      );
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
        }}>
        <div
          data-min-resize={element['props'] && element['props'].minResize}
          ref={(ele) => {
            if (ele && splitPanelService.panels.indexOf(ele) === -1) {
              splitPanelService.panels.push(ele);
            }
          }}
          id={element['props'] && element['props'].id}
          style={{
            [Layout.getSizeProperty(direction)]: getElementSize(element),
            // 相对尺寸带来的问题，必须限制最小最大尺寸
            [Layout.getMinSizeProperty(direction)]: element['props'] && element['props'].minSize ? element['props'].minSize + 'px' : '-1px',
            [Layout.getMaxSizeProperty(direction)]: maxLocks[index] ? element['props'].minSize + 'px' : 'unset',
            flexGrow: element['props'] && element['props'].flexGrow !== undefined ? element['props'].flexGrow : 'unset',
            display: hides[index] ? 'none' : 'block',
          }}>
          {element}
        </div>
      </PanelContext.Provider>,
    );
  });

  function getElementSize(element) {
    if (element.props.flex) {
      return element.props.flex / totalFlexNum * 100 + '%';
    } else if (element.props.defaultSize) {
      return element.props.defaultSize + 'px';
    } else {
      return 1 / totalFlexNum * 100 + '%';
    }
  }

  React.useEffect(() => {
    if (rootRef.current) {
      splitPanelService.rootNode = rootRef.current;
    }
    const disposer = eventBus.on(ResizeEvent, (e) => {
      if (e.payload.slotLocation === id) {
        childList.forEach((c) => {
          fireResizeEvent(c['props'] && c['props'].slot || c['props'] && c['props'].id);
        });
      }
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  return (
    <div
      ref={(ele) => rootRef.current = ele!}
      {...restProps}
      className={clsx(styles['split-panel'], className)}
      style={
        {flexDirection: Layout.getFlexDirection(direction)}
      }
    >
      {elements}
    </div>
  );
});
