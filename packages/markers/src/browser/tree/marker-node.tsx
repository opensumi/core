import cls from 'classnames';
import React, { FC, ReactNode, memo, useCallback } from 'react';

import {
  Badge,
  ClasslistComposite,
  CompositeTreeNode,
  INodeRendererProps,
  TreeNode,
  TreeNodeType,
} from '@opensumi/ide-components';
import {
  IMatch,
  IOpenerService,
  URI,
  Uri,
  getIcon,
  useDesignStyles,
  useInjectable,
  withPrevented,
} from '@opensumi/ide-core-browser';

import { IRenderableMarker, IRenderableMarkerModel } from '../../common/types';

import { MarkerGroupNode, MarkerNode } from './tree-node.defined';
import styles from './tree-node.module.less';

export interface IMarkerNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType, activeUri?: URI) => void;
}

export type IMarkerNodeRenderedProps = IMarkerNodeProps & INodeRendererProps;

/**
 * render marker filepath
 * @param model model of renderable marker
 */
const MarkerItemTitleDescription: FC<{ model: IRenderableMarkerModel }> = memo(({ model }) => (
  <div className={styles.title_description}>{model.longname}</div>
));

/**
 * render highlight info which is filterd
 */
const HighlightData: FC<{
  data: string;
  matches: IMatch[];
  className: string;
}> = memo(({ data, matches, className }) => {
  const result: ReactNode[] = [];
  let first = 0;
  matches.forEach((match) => {
    if (first < match.start) {
      result.push(<span key={`highlight-data-${first}-${match.start}`}>{data.substring(first, match.start)}</span>);
    }
    result.push(
      <span key={`highlight-data-${match.start}-${match.end}`} className={styles.highlight}>
        {data.substring(match.start, match.end)}
      </span>,
    );
    first = match.end;
  });
  if (first < data.length) {
    result.push(<span key={`highlight-data-${first}-${data.length - 1}`}>{data.substring(first)}</span>);
  }
  return <div className={className}>{result}</div>;
});

/**
 * render marker message
 */
const MarkerItemName: FC<{ marker: IRenderableMarker }> = memo(({ marker }) => {
  const messageMatches = marker.matches && marker.matches.messageMatches;
  if (messageMatches) {
    return <HighlightData data={marker.message} matches={messageMatches} className={styles.detail_name} />;
  } else {
    return <div className={styles.detail_name}>{marker.message}</div>;
  }
});

const MarkerCode: FC<{
  data: string;
  href?: Uri;
  matches?: IMatch[] | null;
  type: string;
}> = memo(({ data, href, matches, type }) => {
  const openner = useInjectable(IOpenerService) as IOpenerService;

  const code = matches ? <HighlightData data={data} matches={matches} className={type} /> : <>{data}</>;
  if (typeof href !== 'undefined') {
    return (
      <a
        className={styles.codeHref}
        rel='noopener'
        target='_blank'
        onClick={withPrevented(() => {
          openner.open(new URI(href));
        })}
        title={data}
      >
        {code}
      </a>
    );
  }
  return code;
});

/**
 * render marker source and code
 */
const MarkerItemDescription: FC<{ marker: IRenderableMarker }> = memo(({ marker }) => {
  const sourceMatches = marker.matches && marker.matches.sourceMatches;
  const codeMatches = marker.matches && marker.matches.codeMatches;
  return (
    <div className={styles.detail_description}>
      <div className={styles.typeContainer}>
        {sourceMatches
          ? marker.source && <HighlightData data={marker.source} matches={sourceMatches} className={styles.type} />
          : marker.source}
        {marker.code && '('}
        {marker.code && (
          <MarkerCode data={marker.code} href={marker.codeHref} matches={codeMatches} type={styles.type} />
        )}
        {marker.code && ')'}
      </div>
      <div className={styles.position}>{`[Ln ${marker.startLineNumber}, Col ${marker.startColumn}]`}</div>
    </div>
  );
});

/**
 * render marker filename
 * @param model model of renderable marker
 */
const MarkerItemTitleName: FC<{ model: IRenderableMarkerModel }> = memo(({ model }) => {
  const filenameMatches = model.matches && model.matches.filenameMatches;
  if (filenameMatches) {
    return <HighlightData data={model.filename} matches={filenameMatches} className={styles.title} />;
  } else {
    return <div className={styles.title}>{model.filename}</div>;
  }
});

export const MarkerNodeRendered: React.FC<IMarkerNodeRenderedProps> = ({
  item,
  defaultLeftPadding = 8,
  leftPadding = 8,
  itemType,
  decorations,
  onClick,
}: IMarkerNodeRenderedProps) => {
  const styles_expansion_toggle = useDesignStyles(styles.expansion_toggle, 'expansion_toggle');
  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.stopPropagation();
      if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        onClick(ev, item as MarkerNode, itemType);
      }
    },
    [onClick],
  );

  const paddingLeft = `${
    defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + (!MarkerGroupNode.is(item) ? 16 : 0)
  }px`;

  const renderedNodeStyle = {
    lineHeight: `${MARKER_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderIcon = useCallback(
    (node: MarkerGroupNode | MarkerNode) => (
      <div
        className={cls(styles.icon, MarkerGroupNode.is(node) && node.icon)}
        style={{
          height: MARKER_TREE_NODE_HEIGHT,
          lineHeight: `${MARKER_TREE_NODE_HEIGHT}px`,
          ...(!MarkerGroupNode.is(node) && node.iconStyle),
        }}
      ></div>
    ),
    [],
  );

  const renderDisplayName = useCallback((node: MarkerGroupNode | MarkerNode) => {
    if (MarkerGroupNode.is(node)) {
      return <MarkerItemTitleName model={node.model} />;
    } else {
      return <MarkerItemName marker={node.marker} />;
    }
  }, []);

  const renderDescription = useCallback((node: MarkerGroupNode | MarkerNode) => {
    if (MarkerGroupNode.is(node)) {
      return <MarkerItemTitleDescription model={node.model} />;
    } else {
      return <MarkerItemDescription marker={node.marker} />;
    }
  }, []);

  const renderStatusTail = useCallback(
    (node: MarkerGroupNode | MarkerNode) => <div className={cls(styles.segment, styles.tail)}>{renderBadge(node)}</div>,
    [],
  );

  const renderBadge = useCallback((node: MarkerGroupNode | MarkerNode) => {
    if (MarkerGroupNode.is(node)) {
      return <Badge className={styles.status}>{node.badge}</Badge>;
    }
  }, []);

  const renderFolderToggle = useCallback(
    (node: MarkerGroupNode) => (
      <div
        className={cls(styles.segment, styles_expansion_toggle, getIcon('arrow-right'), {
          [`${styles.mod_collapsed}`]: !(node as MarkerGroupNode).expanded,
        })}
      />
    ),
    [],
  );

  const renderTwice = useCallback((node: MarkerGroupNode | MarkerNode) => {
    if (MarkerGroupNode.is(node)) {
      return renderFolderToggle(node);
    }
  }, []);

  const getItemTooltip = useCallback(() => item.tooltip, [item]);

  return (
    <div
      key={item.id}
      onClick={handleClick}
      title={getItemTooltip()}
      className={cls(styles.marker_node, decorations ? decorations.classlist : null)}
      style={renderedNodeStyle}
      data-id={item.id}
    >
      <div className={styles.content}>
        {renderTwice(item)}
        {renderIcon(item)}
        <div className={styles.overflow_wrap}>
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderStatusTail(item)}
      </div>
    </div>
  );
};

export const MARKER_TREE_NODE_HEIGHT = 22;
