import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IResizeHandleDelegate } from '../resize/resize';
import { IEventBus } from '@ali/ide-core-common';
import { ResizeEvent } from '../../layout';

export const PanelContext = React.createContext<{
  setSize: (targetSize: number, side: string) => void,
  getSize: (side: string) => number,
}>({
  setSize: (targetSize: number, side: string) => {},
  getSize: (side: string) => 0,
});

export const SplitPanel: React.FC<{
  children?: Array<React.ReactElement<{ id: string; minSize?: number; maxSize?: number; flex?: number; slot: string; }>>;
  className?: string;
  direction?: Layout.direction;
  flex?: number;
}> = (({ className, children = [], direction = 'left-to-right', ...restProps }) => {
  const ResizeHandle = Layout.getResizeHandle(direction);
  const totalFlexNum = children.reduce((accumulator, item) => accumulator + (item.props.flex || 1), 0);
  const panels: {[panelId: string]: React.ReactElement<any>} = {};
  const elements: React.ReactNodeArray = [];
  const resizeDelegates: IResizeHandleDelegate[] = [];
  const eventBus = useInjectable<IEventBus>(IEventBus);

  const setSizeHandle = (index) => {
    return (size, side) => {
      const targetIndex = side === 'right' || side === 'bottom' ? index - 1 : index;
      if (resizeDelegates[targetIndex]) {
        resizeDelegates[targetIndex].setAbsoluteSize(size, side === 'right' || side === 'bottom' ? true : false);
      }
    };
  };

  const getSizeHandle = (index) => {
    return (side) => {
      const targetIndex = side === 'right' || side === 'bottom' ? index - 1 : index;
      if (resizeDelegates[targetIndex]) {
        return resizeDelegates[targetIndex].getAbsoluteSize(side === 'right' || side === 'bottom' ? true : false);
      }
      return 0;
    };
  };

  children.forEach((element, index) => {
    const panelId = element.props.id;
    panels[panelId] = element;
    if (index !== 0) {
      // FIXME window resize支持
      elements.push(<ResizeHandle onResize={(prev, next) => {
        const prevLocation = children[index - 1].props.slot;
        const nextLocation = children[index].props.slot;
        if (prevLocation) {
          eventBus.fire(new ResizeEvent({slotLocation: prevLocation, width: prev.clientWidth, height: prev.clientHeight}));
        }
        if (nextLocation) {
          eventBus.fire(new ResizeEvent({slotLocation: nextLocation, width: next.clientWidth, height: next.clientHeight}));
        }
      }} key={`split-handle-${index}`} delegate={(delegate) => { resizeDelegates.push(delegate); }} />);
    }
    elements.push(
      <PanelContext.Provider value={{setSize: setSizeHandle(index), getSize: getSizeHandle(index)}}>
        <div key={panelId} style={{[Layout.getSizeProperty(direction)]: ((element.props.flex || 1) / totalFlexNum * 100) + '%'}}>
          {element}
        </div>
      </PanelContext.Provider>,
    );
  });
  return (
    <div {...restProps} className={clsx(styles['split-panel'])} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {elements}
    </div>
  );
});
