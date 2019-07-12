import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './panel.module.less';

export interface IExplorerAction {
  iconClass: string;
  action: () => void;
  title: string;
}

export interface CollapsePanelProps extends React.PropsWithChildren<any> {
  // panel 头部标题
  header: string;
  // key 用于识别唯一panel的id
  key: string;
  // key 作为map时的key，同时需要panel用的key
  panelKey?: string;
  // 头部样式名
  headerClass?: string;
  // panel 点击事件监听
  onItemClick?: any;
  // 计算宽度时的优先级
  priority?: number;
  // panel宽高
  size?: {
    width: string | number;
    height: string | number;
  };
  // 工具栏
  actions?: IExplorerAction[];
}

export const CollapsePanel = (
  {
    header,
    headerClass,
    onItemClick,
    panelKey,
    children,
    isActive,
    onResize,
    actions,
    size,
  }: CollapsePanelProps,
) => {

  const clickHandler = (event) => {
    onItemClick(event, panelKey);
  };

  const attrs = {
    tabIndex: 0,
  };

  React.useEffect(() => {
    if (onResize) {
      onResize(size);
    }
  }, [size]);

  // 往子元素添加布局属性
  const getNewChild = (child, index) => {
    if (!child) { return null; }
    const key: string = child.key || String(index);
    const props = {
      key,
      ...size,
    };

    return React.cloneElement(child, props);
  };

  const getItems = (children: React.ReactChild) => {
    const newChildren = React.Children.map(children, getNewChild);
    return newChildren;
  };

  const getActionItem = (actions: IExplorerAction[]) => {
    return actions.map((action: IExplorerAction, index: number) => {
      return <a key={index} title={action.title} className={cls(styles.kt_panel_toolbar_item, styles[action.iconClass] || action.iconClass)} onClick={action.action}></a>;
    });
  };

  const getActionToolBar = (actions: IExplorerAction[] | undefined) => {
    if (actions && actions.length > 0) {
      return <div className={styles.kt_panel_toolbar}>
        <div className={styles.kt_panel_toolbar_container}>
          { getActionItem(actions) }
        </div>
      </div>;
    }
    return null;
  };

  const bodyStyle = {
    overflow : isActive ? 'visible' : 'hidden',
  } as React.CSSProperties;

  return  <div className={ styles.kt_split_overlay } style={ size }  >
    <div className={ styles.kt_split_panel }>
      <div {...attrs} className={ cls(isActive ? '' : styles.kt_mod_collapsed, styles.kt_split_panel_header, headerClass)} onClick={clickHandler}>{header}</div>
      { getActionToolBar(actions) }
      <div className={ styles.kt_split_panel_body } style={ bodyStyle }>
         { getItems(children) }
      </div>
    </div>
  </div >;
};
