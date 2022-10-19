import cls from 'classnames';
import React from 'react';

import { getIcon, ErrorBoundary, useViewState } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Layout, PanelContext } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionBar, InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { isIMenu, IMenu, IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { transformLabelWithCodicon } from '@opensumi/ide-core-browser/lib/utils/label';
import { IIconService } from '@opensumi/ide-theme';

import { AccordionService } from './accordion.service';
import styles from './styles.module.less';


export interface CollapsePanelProps extends React.PropsWithChildren<any> {
  // panel 头部标题
  header: string;
  // panel 头部描述
  description?: string;
  // panel 信息
  message?: string;
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
  accordionService: AccordionService;
}

const attrs = {
  tabIndex: 0,
};

export const AccordionSection = ({
  header,
  description,
  message,
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
  accordionService,
  onContextMenuHandler,
}: CollapsePanelProps) => {
  const iconService = useInjectable<IIconService>(IIconService);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [headerFocused, setHeaderFocused] = React.useState(false);
  const [headerLabel, setHeaderLabel] = React.useState(header);
  const [headerDescription, setheaderDescription] = React.useState(description);
  const [panelMessage, setPanelMessage] = React.useState(message);

  const { getSize, setSize } = React.useContext(PanelContext);

  React.useEffect(() => {
    const disposable = accordionService.onDidChangeViewTiele(({ id, title, description, message: msg }) => {
      if (viewId === id && title && title !== headerLabel) {
        setHeaderLabel(title);
      }

      if (viewId === id && description && description !== headerDescription) {
        setheaderDescription(description);
      }

      if (viewId === id && msg && msg !== panelMessage) {
        setPanelMessage(msg);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, []);

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
              {headerLabel}
            </div>
            {headerDescription && (
              <div className={styles.section_description} style={{ lineHeight: headerSize + 'px' }}>
                {transformLabelWithCodicon(headerDescription, {}, iconService.fromString.bind(iconService))}
              </div>
            )}
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
          {panelMessage && <span className={styles.kt_split_panel_message}>{panelMessage}</span>}
          <Component {...initialProps} viewState={viewState} />
        </ErrorBoundary>
      </div>
    </div>
  );
};
