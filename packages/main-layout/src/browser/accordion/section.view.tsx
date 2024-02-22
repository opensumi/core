import cls from 'classnames';
import React from 'react';

import { ErrorBoundary, getIcon, useDesignStyles, useInjectable, useViewState } from '@opensumi/ide-core-browser';
import { Layout } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionBar, InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { IContextMenu, IMenu, isIMenu } from '@opensumi/ide-core-browser/lib/menu/next';
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
  badge,
  headerClass,
  onItemClick,
  noHeader,
  children,
  expanded,
  headerSize,
  viewId,
  initialProps,
  titleMenu,
  titleMenuContext,
  accordionService,
  onContextMenuHandler,
  alignment,
}: CollapsePanelProps) => {
  const iconService = useInjectable<IIconService>(IIconService);
  const styles_actions_wrap = useDesignStyles(styles.actions_wrap);
  const styles_kt_split_panel = useDesignStyles(styles.kt_split_panel);
  const styles_kt_split_panel_header = useDesignStyles(styles.kt_split_panel_header);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [metadata, setMetadata] = React.useState({
    header,
    description,
    message,
    badge,
  });

  React.useEffect(() => {
    const disposable = accordionService.onDidChangeViewTitle(({ id, title, description, message: msg, badge }) => {
      let changed = false;
      const newMetadata = {
        ...metadata,
      };
      if (viewId === id && title && title !== metadata.header) {
        newMetadata.header = title;
        changed = true;
      }

      if (viewId === id && badge !== metadata.badge) {
        newMetadata.badge = badge;
        changed = true;
      }

      if (viewId === id && description && description !== metadata.badge) {
        newMetadata.description = description;
        changed = true;
      }

      if (viewId === id && msg && msg !== metadata.message) {
        newMetadata.message = msg;
        changed = true;
      }
      if (changed) {
        setMetadata(newMetadata);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, []);

  const clickHandler = React.useCallback(() => {
    onItemClick();
  }, [onItemClick]);

  const bodyStyle = React.useMemo<React.CSSProperties>(
    () => ({
      overflow: expanded ? 'auto' : 'hidden',
    }),
    [expanded],
  );

  const viewState = useViewState(viewId, contentRef, true);
  const progressService: IProgressService = useInjectable(IProgressService);
  const indicator = progressService.getIndicator(viewId);
  const Component: any = children;
  const computedHeaderSize = React.useMemo(() => {
    if (expanded) {
      return `${headerSize}px`;
    }

    if (alignment === 'horizontal') {
      return '100%';
    }
    return `${headerSize}px`;
  }, [expanded, headerSize, alignment]);

  return (
    <div className={styles_kt_split_panel} data-view-id={viewId}>
      {!noHeader && (
        <div
          {...attrs}
          className={cls(styles_kt_split_panel_header, headerClass)}
          onClick={clickHandler}
          onContextMenu={(e) => onContextMenuHandler(e, viewId)}
          style={{ height: computedHeaderSize, lineHeight: computedHeaderSize }}
        >
          <div className={styles.label_wrap}>
            <i className={cls(getIcon('arrow-down'), styles.arrow_icon, expanded ? '' : styles.kt_mod_collapsed)}></i>
            <div className={styles.section_label} style={{ lineHeight: headerSize + 'px' }}>
              {metadata.header}
            </div>
            {metadata.description && (
              <div className={styles.section_description} style={{ lineHeight: headerSize + 'px' }}>
                {transformLabelWithCodicon(metadata.description, {}, iconService.fromString.bind(iconService))}
              </div>
            )}
            {metadata.badge && <div className={styles.section_badge}>{metadata.badge}</div>}
          </div>
          {expanded && titleMenu && (
            <div className={styles_actions_wrap}>
              {isIMenu(titleMenu) ? (
                <InlineActionBar menus={titleMenu} context={titleMenuContext} />
              ) : (
                <InlineMenuBar menus={titleMenu} context={titleMenuContext} />
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
        <ProgressBar className={styles.progressBar} progressModel={indicator!.progressModel} />
        <ErrorBoundary>
          {metadata.message && <div className={styles.kt_split_panel_message}>{metadata.message}</div>}
          <Component
            {...initialProps}
            viewState={{ height: viewState.height - (metadata.message ? 22 : 0), width: viewState.width }}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
};
