import cls from 'classnames';
import React from 'react';

import {
  ErrorBoundary,
  getIcon,
  useAutorun,
  useDesignStyles,
  useInjectable,
  useViewState,
} from '@opensumi/ide-core-browser';
import { Layout } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionBar, InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { IContextMenu, IMenu, isIMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { transformLabelWithCodicon } from '@opensumi/ide-core-browser/lib/utils/label';
import { IIconService } from '@opensumi/ide-theme';

import { AccordionService } from './accordion.service';
import styles from './styles.module.less';

import type { ViewBadge } from 'vscode';

export interface CollapsePanelProps extends React.PropsWithChildren<any> {
  // Header Title
  header: string;
  // Header Description
  description?: string | React.ReactNode;
  // Panel Message
  message?: string;
  // Header Size
  headerSize?: number;
  // Header Class
  headerClass?: string;
  // Handle Panel Click
  onItemClick?: any;
  // Handle Panel Context Menu
  onContextMenuHandler: any;
  // Panel Weight
  weight?: number;
  // Panel Order Priority
  priority?: number;
  // Panel Size
  size?: {
    width: number;
    height: number;
  };
  // Panel View Id
  viewId: string;
  // Panel Alignment
  alignment?: Layout.alignment;
  // Panel Index
  index: number;
  // Panel Initial Props
  initialProps?: any;
  // Panel No Header
  noHeader?: boolean;
  // Panel Title Menu
  titleMenu: IMenu | IContextMenu;
  // Panel Accordion Service
  accordionService: AccordionService;
  // Panel Badge
  badge?: string | ViewBadge;
  // Panel Expanded
  expanded?: boolean;
  // Panel Title Menu Context
  titleMenuContext?: any;
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
  badge,
  headerSize,
  viewId,
  initialProps,
  titleMenu,
  titleMenuContext,
  expanded,
  accordionService,
  onContextMenuHandler,
  alignment,
}: CollapsePanelProps) => {
  const iconService = useInjectable<IIconService>(IIconService);
  const styles_actions_wrap = useDesignStyles(styles.actions_wrap, 'actions_wrap');
  const styles_kt_split_panel = useDesignStyles(styles.kt_split_panel, 'kt_split_panel');
  const styles_kt_split_panel_header = useDesignStyles(styles.kt_split_panel_header, 'kt_split_panel_header');
  const styles_kt_split_panel_body = useDesignStyles(styles.kt_split_panel_body, 'kt_split_panel_body');
  const styles_section_badge = useDesignStyles(styles.section_badge, 'section_badge');
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

      if (viewId === id && description && description !== metadata.description) {
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
    <div className={styles_kt_split_panel} data-view-id={viewId} draggable={false}>
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
                {typeof metadata.description === 'string'
                  ? transformLabelWithCodicon(metadata.description, {}, iconService.fromString.bind(iconService))
                  : metadata.description}
              </div>
            )}
            {metadata.badge && (
              <div className={styles_section_badge}>
                {typeof metadata.badge == 'string' ? metadata.badge : metadata.badge.value}
              </div>
            )}
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
        className={cls([styles_kt_split_panel_body, { [styles.hide]: !expanded }])}
        style={bodyStyle}
        ref={contentRef}
      >
        {<ProgressBar className={styles.progressBar} progressModel={indicator!.progressModel} />}
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
