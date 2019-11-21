import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './styles.module.less';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { Layout, PanelContext } from '@ali/ide-core-browser/lib/components';

export interface IExplorerAction {
  iconClass: string;
  action: () => void;
  title: string;
}

export interface CollapsePanelProps extends React.PropsWithChildren<any> {
  // panel 头部标题
  header: string;
  // 头部样式名
  headerClass?: string;
  // panel 点击事件监听
  onItemClick?: any;
  // 计算宽度时的优先级
  weight?: number;
  // 排序优先级
  priority?: number;
  // panel宽高
  size?: {
    width: number;
    height: number;
  };
  // 工具栏
  actions?: IExplorerAction[];
  headerSize?: number;
  viewId: string;
  alignment?: Layout.alignment;
  index: number;
  isLast: boolean;
}

export const AccordionSection = (
  {
    header,
    headerClass,
    onItemClick,
    children,
    expanded,
    onResize,
    actions,
    size,
    headerSize,
    viewId,
    index,
    isLast,
    alignment = 'vertical',
  }: CollapsePanelProps,
) => {
  // TODO resize监听
  const contentRef = React.useRef<HTMLDivElement | null>();
  const [headerFocused, setHeaderFocused] = React.useState(false);

  const { setSize, getSize } = React.useContext(PanelContext);

  const clickHandler = () => {
    const currentSize = getSize(false);
    onItemClick((targetSize) => setSize(targetSize, false), currentSize);
  };

  const attrs = {
    tabIndex: 0,
  };

  React.useEffect(() => {
    if (onResize) {
      onResize(size);
    }
  }, [size]);

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

  const headerFocusHandler = () => {
    setHeaderFocused(true);
  };

  const headerBlurHandler = () => {
    setHeaderFocused(false);
  };

  const bodyStyle = {
    overflow : expanded ? 'visible' : 'hidden',
  } as React.CSSProperties;
  const Component: any = children;
  return  (
    <div className={ styles.kt_split_panel } >
      <div
      onFocus={ headerFocusHandler }
      onBlur={ headerBlurHandler }
      {...attrs}
      className={ cls(expanded ? '' : styles.kt_mod_collapsed, getIcon('right'), styles.kt_split_panel_header, headerFocused ? styles.kt_panel_focused : '', headerClass)}
      onClick={clickHandler}
      >
        {header}
      </div>
      { getActionToolBar(actions) }
      <div
        className={ styles.kt_split_panel_body }
        style={ bodyStyle }
        ref={(ele) =>  contentRef.current = ele}
      >
        <Component viewState={{width: 100, height: 100}} />
      </div>
    </div>
  );
};
