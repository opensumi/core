import cls from 'classnames';
import React, { useCallback } from 'react';

import { CommandService } from '@opensumi/ide-core-common';

import { Icon } from '../../../components';
import { MenuNode } from '../../../menu/next/base';
import { IBrowserCtxMenu } from '../../../menu/next/renderer/ctxmenu/browser';
import { useInjectable } from '../../../react-hooks';

import styles from './styles.module.less';

interface IEnhanceIconProps {
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  icon?: string;
  iconClass?: string;
  children?: React.ReactNode;
  tabIndex?: number;
  role?: string;
  ariaLabel?: string;
  ariaPressed?: boolean | 'mixed' | 'false' | 'true' | undefined;
}

export const EnhanceIcon = React.forwardRef<HTMLDivElement | null, IEnhanceIconProps>(
  (props: IEnhanceIconProps, ref?) => (
    <div
      className={cls(props.wrapperClassName, styles.ai_enhance_icon)}
      style={props.wrapperStyle}
      onClick={props.onClick}
      ref={ref}
      tabIndex={props.tabIndex}
      role={props.role}
      aria-label={props.ariaLabel}
      aria-pressed={props.ariaPressed}
    >
      <Icon
        className={cls(props.className, styles.icon)}
        children={null}
        onClick={() => null}
        style={(props.icon || props.iconClass) && props.children ? { marginRight: 5 } : {}}
        icon={props.icon}
        iconClass={props.iconClass}
      />
      {props.children && <span className={styles.children_wrap}>{props.children}</span>}
    </div>
  ),
);

interface IEnhanceIconWithCtxMenuProps extends IEnhanceIconProps {
  id?: string;
  menuNodes: MenuNode[];
  skew?: { x: number; y: number };
}

/**
 * 包含下拉菜单的 icon 组件，可以自定义下拉菜单位置
 */
export const EnhanceIconWithCtxMenu = (props: IEnhanceIconWithCtxMenuProps) => {
  const { children, menuNodes, skew, id: commandId, ...restProps } = props;
  const commandService = useInjectable<CommandService>(CommandService);

  const ctxMenuRenderer = useInjectable<IBrowserCtxMenu>(IBrowserCtxMenu);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | undefined>(undefined);
  const iconRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    handleRefRect();
  }, [iconRef.current, skew]);

  const handleRefRect = useCallback(
    (cb?: (_anchor: { x: number; y: number }) => void) => {
      requestAnimationFrame(() => {
        if (iconRef.current) {
          const rect = iconRef.current.getBoundingClientRect();
          const { x, y, width, height } = rect;
          const _anchor = {
            x: x + width,
            y: y + height,
          };

          if (skew) {
            _anchor.x += skew.x;
            _anchor.y += skew.y;
          }

          setAnchor(_anchor);

          if (cb) {
            cb(_anchor);
          }
        }
      });
    },
    [iconRef.current, skew],
  );

  const handleClick = React.useCallback(() => {
    if (!anchor) {
      return;
    }
    if (menuNodes) {
      handleRefRect((_anchor) => {
        ctxMenuRenderer.show({
          anchor: _anchor,
          menuNodes,
        });
      });
    } else if (commandId) {
      commandService.executeCommand(commandId);
    }
  }, [iconRef.current, menuNodes, anchor, commandId]);

  return (
    <EnhanceIcon ref={iconRef} onClick={handleClick} {...restProps}>
      {children}
    </EnhanceIcon>
  );
};

export const AILogoAvatar = (props: { className?: string; iconClassName?: string }) => (
  <div className={cls(styles.ai_logo_avatar_container, props.className)}>
    <Icon icon={'magic-wand'} className={cls(props.iconClassName, styles.avatar_icon)} />
  </div>
);
