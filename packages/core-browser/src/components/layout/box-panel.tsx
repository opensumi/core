import clsx from 'classnames';
import React from 'react';

import { Layout } from './layout';
import styles from './styles.module.less';

export interface IChildComponentProps {
  /**
   * 创建的 div 标签样式中要使用的 flex 属性
   */
  flex?: number;
  /**
   * 创建的 div 标签样式中要使用的默认宽度
   */
  defaultSize?: number;
  id: string;
  overflow: string;
  /**
   * 创建的 div 标签样式中要使用的 zIndex 属性
   */
  zIndex?: number;
  /**
   * 创建的 div 标签样式中要使用的 z-index 属性
   */
  'z-index'?: number;
  /**
   * 创建的 div 标签样式中要使用的 backgroundColor 属性
   */
  backgroundColor?: string;

  // 以上都是老代码，直接取 props 的相关属性太直接了
  // 优雅一些的做法是使用 data- 标签
  /**
   * 创建的 div 标签要使用的 id
   */
  'data-wrapper-id'?: string;
  /**
   * 创建的 div 标签要使用的 className
   */
  'data-wrapper-class'?: string;
}

type ChildComponent = React.ReactElement<IChildComponentProps>;

/**
 * 包裹放入其中的元素，并为每个元素创建一个 div
 *
 * 可以通过修改传入的 children 的 props 来定义一些属性，props 的定义可见：{ @link ChildComponent }
 */
export const BoxPanel: React.FC<{
  children?: ChildComponent | ChildComponent[];
  className?: string;
  direction?: Layout.direction;
  flex?: number;
  zIndex?: number;
}> = ({ className, children = [], direction = 'left-to-right', ...restProps }) => {
  // convert children to list
  const arrayChildren = React.Children.toArray(children) as ChildComponent[];

  return (
    <div
      {...restProps}
      className={clsx(styles['box-panel'], className)}
      style={{ flexDirection: Layout.getFlexDirection(direction), zIndex: restProps['z-index'] }}
    >
      {arrayChildren.map((child, index) => (
        <div
          key={index}
          id={child['props']?.['data-wrapper-id']}
          className={clsx(styles.wrapper, child['props']?.['data-wrapper-class'])}
          style={
            child['props']
              ? {
                  flex: child['props'].flex,
                  overflow: child['props'].overflow,
                  zIndex: child['props'].zIndex || child['props']['z-index'],
                  [Layout.getMinSizeProperty(direction)]: child['props'].defaultSize,
                  backgroundColor: child['props'].backgroundColor,
                }
              : {}
          }
        >
          {child}
        </div>
      ))}
    </div>
  );
};
