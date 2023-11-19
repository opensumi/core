import cls from 'classnames';
import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, IconProps } from '@opensumi/ide-core-browser/lib/components';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

import { AiBrowserCtxMenuService } from '../override/ai-menu.service';

import * as styles from './components.module.less';

interface IEnhanceIconProps extends IconProps {
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
}

export const EnhanceIcon = React.forwardRef<HTMLDivElement | null, IEnhanceIconProps>(
  (props: IEnhanceIconProps, ref?) => (
    <div
      className={cls(props.wrapperClassName, styles.ai_enhance_icon)}
      style={props.wrapperStyle}
      onClick={props.onClick}
      ref={ref}
    >
      <Icon
        {...props}
        className={cls(props.className, styles.icon)}
        children={null}
        onClick={() => null}
        style={(props.icon || props.iconClass) && props.children ? { marginRight: 5 } : {}}
      />
      {props.children && <span className={styles.children_wrap}>{props.children}</span>}
    </div>
  ),
);

interface IEnhanceIconWithCtxMenuProps extends IEnhanceIconProps {
  menuNodes: MenuNode[];
  skew?: { x: number; y: number };
}

/**
 * 包含下拉菜单的 icon 组件，可以自定义下拉菜单位置
 */
export const EnhanceIconWithCtxMenu = (props: IEnhanceIconWithCtxMenuProps) => {
  const { children, menuNodes, skew } = props;

  const ctxMenuRenderer = useInjectable<AiBrowserCtxMenuService>(IBrowserCtxMenu);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | undefined>(undefined);
  const iconRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
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
      }
    });
  }, [iconRef.current, skew]);

  const handleClick = React.useCallback(() => {
    if (!anchor) {
      return;
    }

    ctxMenuRenderer.show({
      anchor,
      menuNodes,
    });
  }, [iconRef.current, menuNodes, anchor]);

  return (
    <EnhanceIcon {...props} ref={iconRef} onClick={handleClick}>
      {children}
    </EnhanceIcon>
  );
};

/**
 * AI Logo
 */
export const AILogoAvatar = (props: { iconClassName?: string }) => (
  <div className={styles.ai_logo_avatar_container}>
    <Icon icon={'magic-wand'} className={cls(props.iconClassName, styles.avatar_icon)} />
  </div>
);
