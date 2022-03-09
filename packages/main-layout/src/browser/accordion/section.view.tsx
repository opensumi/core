import cls from 'classnames';
import React from 'react';


import { getIcon, ErrorBoundary, useViewState } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Layout, PanelContext } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionBar, InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { isIMenu, IMenu, IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import styles from './styles.module.less';

export interface CollapsePanelProps extends React.PropsWithChildren<any> {
  // panel 头部标题
  header: string;
  // 头部样式名
  headerClass?: string;
  // panel 点击事件监听
  onItemClick?: any;
  onContextMenuHandler: any;
  // 计算宽度时的优先级
  weight?: number;
  // 排序优先级
  priority?: number;
  // panel宽高
  size?: {
    width: number;
    height: number;
  };
  headerSize?: number;
  viewId: string;
  alignment?: Layout.alignment;
  index: number;
  initialProps?: any;
  noHeader?: boolean;
  titleMenu: IMenu | IContextMenu;
}

const attrs = {
  tabIndex: 0,
};

export const AccordionSection = ({
  header,
  headerClass,
  onItemClick,
  noHeader,
  children,
  expanded,
  onResize,
  size,
  headerSize,
  viewId,
  initialProps,
  titleMenu,
  titleMenuContext,
  onContextMenuHandler,
}: CollapsePanelProps) => {
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [headerFocused, setHeaderFocused] = React.useState(false);

  const { getSize, setSize } = React.useContext(PanelContext);

  const clickHandler = React.useCallback(() => {
    const currentSize = getSize(false);
    onItemClick((targetSize) => setSize(targetSize, false), currentSize);
  }, [getSize, setSize]);

  const bodyStyle = React.useMemo<React.CSSProperties>(
    () => ({
      overflow: expanded ? 'auto' : 'hidden',
    }),
    [expanded],
  );

  React.useEffect(() => {
    if (onResize) {
      onResize(size);
    }
  }, [size]);

  const headerFocusHandler = React.useCallback(() => {
    setHeaderFocused(true);
  }, []);

  const headerBlurHandler = React.useCallback(() => {
    setHeaderFocused(false);
  }, []);

  const viewState = useViewState(viewId, contentRef, true);
  const progressService: IProgressService = useInjectable(IProgressService);
  const indicator = progressService.getIndicator(viewId)!;

  const Component: any = children;
  return (
    <div className={styles.kt_split_panel} data-view-id={viewId}>
      {!noHeader && (
        <div
          onFocus={headerFocusHandler}
          onBlur={headerBlurHandler}
          {...attrs}
          className={cls(styles.kt_split_panel_header, headerFocused ? styles.kt_panel_focused : '', headerClass)}
          onClick={clickHandler}
          onContextMenu={(e) => onContextMenuHandler(e, viewId)}
          style={{ height: headerSize + 'px', lineHeight: headerSize + 'px' }}
        >
          <div className={styles.label_wrap}>
            <i className={cls(getIcon('arrow-down'), styles.arrow_icon, expanded ? '' : styles.kt_mod_collapsed)}></i>
            <div className={styles.section_label} style={{ lineHeight: headerSize + 'px' }}>
              {header}
            </div>
          </div>
          {expanded && titleMenu && (
            <div className={styles.actions_wrap}>
              {isIMenu(titleMenu) ? (
                <InlineActionBar menus={titleMenu} context={titleMenuContext} />
              ) : (
                <InlineMenuBar menus={titleMenu} />
              )}
            </div>
          )}
        </div>
      )}
      <div
        className={cls([styles.kt_split_panel_body, { [styles.hide]: !expanded }])}
        style={bodyStyle}
        ref={contentRef}
      >
        <ProgressBar className={styles.progressBar} progressModel={indicator.progressModel} />
        <ErrorBoundary>
          <Component {...initialProps} viewState={viewState} />
        </ErrorBoundary>
      </div>
    </div>
  );
};
