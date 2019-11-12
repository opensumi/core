import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from './layout';

export const SplitPanel: React.FC<{
  children?: Array<React.ReactElement<{ id: string; minSize?: number; maxSize?: number; flex?: number; }>>;
  className?: string;
  direction?: Layout.direction;
  flex?: number;
}> = (({ className, children, direction = 'left-to-right', ...restProps }) => {
  if (!children) {
    return null;
  }
  const elements: React.ReactNodeArray = [];
  const ResizeHandle = Layout.getResizeHandle(direction);
  const totalFlexNum = children.reduce((accumulator, item) => accumulator + (item.props.flex || 1), 0);
  children.forEach((element, index) => {
    if (index !== 0) {
      elements.push(<ResizeHandle />);
    }
    elements.push(<div style={{[Layout.getSizeProperty(direction)]: ((element.props.flex || 1) / totalFlexNum * 100) + '%'}}>{element}</div>);
  });
  return (
    <div {...restProps} className={clsx(styles['split-panel'])} style={{flexDirection: Layout.getFlexDirection(direction)}}>
      {elements}
    </div>
  );
});
