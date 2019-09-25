import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugHoverService } from './debug-hover.service';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-hover.module.less';
import { SourceTree } from '@ali/ide-core-browser/lib/components';
import * as cls from 'classnames';

export const DebugHoverView = observer(() => {
  const { value, nodes, onSelect }: DebugHoverService = useInjectable(DebugHoverService);

  const mouseWheelHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const containerWidth = {
    min: 0,
    max: 300,
  };

  const containerHeight = {
    min: 22,
    max: 350,
  };

  const contentWidth = value.length * 20;
  const contentHeight = nodes.length * 22;

  const scrollContainerStyle = {
    width: containerWidth.min > contentWidth ? containerWidth.min : contentWidth > containerWidth.max ? containerWidth.max : contentWidth,
    height: containerHeight.min > contentHeight ? containerHeight.min : contentHeight > containerHeight.max ? containerHeight.max : contentHeight,
  };

  const renderContent = () => {
    if (nodes && nodes.length > 0) {
      return <div
        onWheel={ mouseWheelHandler }
        className={ styles.kaitian_debug_hover_content }
      >
        <SourceTree
          nodes = { nodes }
          onSelect = { onSelect }
          outline = { false }
          scrollContainerStyle = {
            scrollContainerStyle
          }
        />
      </div>;
    }
    return null;
  };

  if (value) {
    return <div className={ styles.kaitian_debug_hover }>
      <div className={ cls(styles.kaitian_debug_hover_title, styles.has_complex_value) }>{ value }</div>
      { renderContent() }
    </div>;
  } else {
    return null;
  }
});
