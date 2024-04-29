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
  delay,
  zIndex = 100,
  onClickAction,
  onVisibleChange,
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

  const overlayContent = useMemo(
    () =>
      overlay || (
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
      ),
    [overlay],
  );

  return (
    <Tooltip
      {...restProps}
      visible={visible}
      placement={position}
      mouseEnterDelay={delay}
      trigger={trigger}
      showArrow={showArrow}
      onVisibleChange={onVisibleChange}
      overlayClassName={overlayClassName}
      prefixCls='kt-popover'
      overlayStyle={overlayStyle}
      overlay={overlayContent}
      zIndex={zIndex}
    >
      {children}
    </Tooltip>
  );
};
