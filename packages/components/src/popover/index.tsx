import cls from 'classnames';
import Tooltip from 'rc-tooltip';
import React, { useCallback, useMemo } from 'react';

import './styles.less';

import { Button } from '../button';

export enum PopoverTriggerType {
  hover = 'hover',
  click = 'click',
  focus = 'focus',
}

export enum PopoverPosition {
  top = 'top',
  bottom = 'bottom',
  left = 'left',
  right = 'right',
  topLeft = 'topLeft',
  topRight = 'topRight',
  bottomLeft = 'bottomLeft',
  bottomRight = 'bottomRight',
  leftTop = 'leftTop',
  leftBottom = 'leftBottom',
  rightTop = 'rightTop',
  rightBottom = 'rightBottom',
}

export interface IPopoverProps {
  id: string;
  content?: React.ReactNode;
  trigger?: PopoverTriggerType | PopoverTriggerType[];
  visible?: boolean;
  position?: PopoverPosition;
  delay?: number;
  title?: string;
  titleClassName?: string;
  showArrow?: boolean;
  action?: string;
  defaultVisible?: boolean;
  overlay?: React.ReactNode | (() => React.ReactNode);
  overlayStyle?: React.CSSProperties;
  overlayClassName?: string;
  zIndex?: number;
  onClickAction?: (args: any) => void;
  onVisibleChange?: (visible: boolean) => void;
  getTooltipContainer?: (triggerNode: HTMLElement) => HTMLElement;
  [key: string]: any;
}

export const Popover: React.FC<IPopoverProps> = ({
  children,
  trigger = PopoverTriggerType.hover,
  visible,
  content,
  position = PopoverPosition.top,
  showArrow = true,
  title,
  titleClassName,
  overlay,
  overlayClassName,
  overlayStyle,
  action,
  delay = 200,
  zIndex = 1000,
  onClickAction,
  onVisibleChange,
  getTooltipContainer,
  ...restProps
}) => {
  const handleActionClick = useCallback(
    (event: React.MouseEvent) => {
      if (onClickAction) {
        onClickAction(event);
      }
    },
    [onClickAction],
  );

  const overlayContent = useMemo(() => {
    if (overlay) {
      return overlay;
    } else {
      if (!title && !content) {
        return null;
      }
      return (
        <>
          {title && (
            <p className={cls('kt-popover-title', titleClassName)}>
              {title}
              {action && (
                <Button size='small' type='link' onClick={handleActionClick}>
                  {action}
                </Button>
              )}
            </p>
          )}
          {content || ''}
        </>
      );
    }
  }, [overlay, content, action, handleActionClick]);

  if (!overlayContent) {
    return children;
  }

  return (
    <Tooltip
      {...restProps}
      visible={visible}
      placement={position}
      mouseEnterDelay={delay ? delay / 1000 : undefined}
      trigger={trigger}
      showArrow={showArrow}
      onVisibleChange={onVisibleChange}
      overlayClassName={overlayClassName}
      prefixCls='kt-popover'
      overlayStyle={overlayStyle}
      getTooltipContainer={getTooltipContainer}
      overlay={overlayContent}
      zIndex={zIndex}
    >
      <div className='kt-popover-trigger'>{children}</div>
    </Tooltip>
  );
};
