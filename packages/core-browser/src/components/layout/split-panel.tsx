import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IResizeHandleDelegate } from '../resize/resize';
import { IEventBus } from '@ali/ide-core-common';
import { ResizeEvent } from '../../layout';
import { SplitPanelManager } from './split-panel.service';

export const PanelContext = React.createContext<{
  setSize: (targetSize: number, isLatter: boolean) => void,
  setRelativeSize: (prev: number, next: number, isLatter: boolean) => void,
  getSize: (isLatter: boolean) => number,
  getRelativeSize: (isLatter: boolean) => number[],
}>({
  setSize: (targetSize: number, isLatter: boolean) => {},
  setRelativeSize: (prev, next, isLatter) => {},
  getSize: (isLatter: boolean) => 0,
  getRelativeSize: (isLatter: boolean) => [0, 0],
});

interface SplitChildProps { id: string; minSize?: number; maxSize?: number; flex?: number; slot: string; children?: Array<React.ReactElement<SplitChildProps>>; }

export const SplitPanel: React.FC<{
  children?: Array<React.ReactElement<SplitChildProps>>;
  className?: string;
  direction?: Layout.direction;
  flex?: number;
  id: string;
  // setAbsoluteSize 时保证相邻节点总宽度不变
  resizeKeep?: boolean;
}> = (({ id, className, children = [], direction = 'left-to-right', resizeKeep = true, ...restProps }) => {
  const ResizeHandle = Layout.getResizeHandle(direction);
  const totalFlexNum = children.reduce((accumulator, item) => accumulator + (item.props.flex !== undefined ? item.props.flex : 1), 0);
  const elements: React.ReactNodeArray = [];
  const resizeDelegates = React.useRef<IResizeHandleDelegate[]>([]);
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const rootRef = React.useRef<HTMLElement>();

  const splitPanelService = useInjectable<SplitPanelManager>(SplitPanelManager).getService(id);
  const refs = splitPanelService.panels;

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

  const fireResizeEvent = (location: string, srcElement: HTMLElement, index: number) => {
    if (location) {
      eventBus.fire(new ResizeEvent({slotLocation: location, width: srcElement.clientWidth, height: srcElement.clientHeight}));
    } else {
      const subChildren = children[index].props.children;
      if (subChildren && subChildren.length) {
        // TODO 多级嵌套
        subChildren!.forEach((child) => {
          if (direction === 'bottom-to-top' || direction === 'top-to-bottom') {
            eventBus.fire(new ResizeEvent({slotLocation: child.props.slot, height: srcElement.clientHeight}));
          } else {
            eventBus.fire(new ResizeEvent({slotLocation: child.props.slot, width: srcElement.clientWidth}));
          }
        });
      }
    }
  };

  children.forEach((element, index) => {
    if (index !== 0) {
      elements.push(
        <ResizeHandle
          onResize={(prev, next) => {
            const prevLocation = children[index - 1].props.slot;
            const nextLocation = children[index].props.slot;
            fireResizeEvent(prevLocation, prev, index - 1);
            fireResizeEvent(nextLocation, next, index);
          }}
          noColor={true}
          findNextElement={(direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction)}
          findPrevElement={(direction: boolean) => splitPanelService.getFirstResizablePanel(index - 1, direction, true)}
          key={`split-handle-${index}`}
          delegate={(delegate) => { resizeDelegates.current.push(delegate); }} />,
      );
    }
    elements.push(
      <PanelContext.Provider key={index} value={{setSize: setSizeHandle(index), getSize: getSizeHandle(index), setRelativeSize: setRelativeSizeHandle(index), getRelativeSize: getRelativeSizeHandle(index)}}>
        <div
          ref={(ele) => {
            if (ele && refs.indexOf(ele) === -1) {
              refs.push(ele);
            }
          }}
          style={{
            [Layout.getSizeProperty(direction)]: ((element.props.flex !== undefined ? element.props.flex : 1) / totalFlexNum * 100) + '%',
            [Layout.getMinSizeProperty(direction)]: element.props.minSize ? element.props.minSize + 'px' : '-1px',
          }}>
          {element}
        </div>
      </PanelContext.Provider>,
    );
  });

  React.useEffect(() => {
    if (rootRef.current) {
      splitPanelService.rootNode = rootRef.current;
    }
  }, []);

  return (
    <div
      ref={(ele) => rootRef.current = ele!}
      {...restProps}
      className={clsx(styles['split-panel'])}
      style={
        {flexDirection: Layout.getFlexDirection(direction)}
      }
    >
      {elements}
    </div>
  );
});
