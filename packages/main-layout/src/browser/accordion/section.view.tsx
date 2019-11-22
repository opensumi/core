import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './styles.module.less';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { Layout, PanelContext } from '@ali/ide-core-browser/lib/components';
import { useInjectable, ViewUiStateManager } from '@ali/ide-core-browser';

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
  initialProps?: any;
  noHeader?: boolean;
}

export const AccordionSection = (
  {
    header,
    headerClass,
    onItemClick,
    noHeader,
    children,
    expanded,
    onResize,
    actions,
    size,
    headerSize,
    viewId,
    index,
    alignment = 'vertical',
    initialProps,
  }: CollapsePanelProps,
) => {
  const viewStateManager = useInjectable<ViewUiStateManager>(ViewUiStateManager);
  const contentRef = React.useRef<HTMLDivElement | null>();
  React.useEffect(() => {
    if (contentRef.current) {
      const ResizeObserver = (window  as any).ResizeObserver;
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          window.requestAnimationFrame(() => {
            viewStateManager.updateSize(viewId, entry.contentRect.height, entry.contentRect.width);
          });
        }
      });
      resizeObserver.observe(contentRef.current);
      return () => {
        resizeObserver.unobserve(contentRef.current);
      };
    }
  }, [contentRef]);

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

  const viewState = viewStateManager.getState(viewId);

  const bodyStyle = {
    overflow : expanded ? 'visible' : 'hidden',
  } as React.CSSProperties;
  const Component: any = children;

  return  (
    <div className={ styles.kt_split_panel } >
      {!noHeader && <div
      onFocus={ headerFocusHandler }
      onBlur={ headerBlurHandler }
      {...attrs}
      className={ cls(styles.kt_split_panel_header, headerFocused ? styles.kt_panel_focused : '', headerClass)}
      onClick={clickHandler}
      >
        <i className={cls(getIcon('right'), styles.arrow_icon, expanded ? '' : styles.kt_mod_collapsed)}></i>
        <h1 className={styles.section_label}>{header}</h1>
      </div>}
      { getActionToolBar(actions) }
      <div
        className={ styles.kt_split_panel_body }
        style={ bodyStyle }
        ref={(ele) =>  contentRef.current = ele}
      >
        <Component {...initialProps} viewState={viewState} />
      </div>
    </div>
  );
};
