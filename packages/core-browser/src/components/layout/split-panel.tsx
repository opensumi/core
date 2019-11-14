import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';
import { useInjectable } from '../../react-hooks';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IResizeHandleDelegate } from '../resize/resize';

export const PanelContext = React.createContext({
  setSize: (targetSize: number, side: string) => {},
});

export const SplitPanel: React.FC<{
  children?: Array<React.ReactElement<{ id: string; minSize?: number; maxSize?: number; flex?: number; }>>;
  className?: string;
  direction?: Layout.direction;
  flex?: number;
}> = (({ className, children = [], direction = 'left-to-right', ...restProps }) => {
  const ResizeHandle = Layout.getResizeHandle(direction);
  const totalFlexNum = children.reduce((accumulator, item) => accumulator + (item.props.flex || 1), 0);
  const panels: {[panelId: string]: React.ReactElement<any>} = {};
  const elements: React.ReactNodeArray = [];
  const resizeDelegates: IResizeHandleDelegate[] = [];
  // TODO
  const delegateHandle = (index) => {
    return (size, side) => {
      const targetIndex = side === 'right' || side === 'bottom' ? index - 1 : index;
      if (resizeDelegates[targetIndex]) {
        resizeDelegates[targetIndex].setAbsoluteSize(size, side === 'right' || side === 'bottom' ? true : false);
      }
    };
  };

  children.forEach((element, index) => {
    const panelId = element.props.id;
    panels[panelId] = element;
    if (index !== 0) {
      elements.push(<ResizeHandle key={`split-handle-${index}`} delegate={(delegate) => { resizeDelegates.push(delegate); }} />);
    }
    elements.push(
      <PanelContext.Provider value={{setSize: delegateHandle(index)}}>
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
