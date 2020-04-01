import * as React from 'react';
import clx from 'classnames';

import './styles.less';

import { defaultIconfont } from './iconfont/iconMap';

export { defaultIconfont };

type DefaultIconMap = typeof defaultIconfont;

export type DefaultIconKeys = keyof DefaultIconMap;

const ktIconPrefixes = ['kaitian-icon kticon-'];

export enum ROTATE_TYPE {
  rotate_90,
  rotate_180,
  rotate_270,
  flip_horizontal,
  flip_vertical,
  flip_both,
}

export enum ANIM_TYPE {
  spin,
  pulse,
}

const ROTATE_CLASS_NAME = ['rotate-90', 'rotate-180', 'rotate-270', 'flip-horizontal', 'flip-vertical', 'flip-both'];
const ANIM_CLASS_NAME = ['spin', 'pulse'];

const iconMap = {
  [ktIconPrefixes[0]]: defaultIconfont,
};

export function getDefaultIcon(iconKey: string, options?: {
  rotate?: ROTATE_TYPE;
  anim?: ANIM_TYPE;
  fill?: boolean;
}): string {
  const {rotate, anim, fill} = options || {};
  let lastIndex = ktIconPrefixes.length;
  while (!iconMap[ktIconPrefixes[--lastIndex]][iconKey]) {
    if (lastIndex === 0) { break; }
  }
  const iconValue = iconMap[ktIconPrefixes[lastIndex]][iconKey];
  if (!iconValue) {
    // tslint:disable no-console
    console.warn('图标库缺失图标:' + iconKey);
    return '';
  }

  let iconClass = `${ktIconPrefixes[lastIndex]}${iconValue}`;
  if (rotate !== undefined) {
    iconClass += ` iconfont-${ROTATE_CLASS_NAME[rotate]}`;
  }
  if (anim !== undefined) {
    iconClass += ` iconfont-anim-${ANIM_CLASS_NAME[anim]}`;
  }
  if (fill) {
    iconClass += ' toggled';
  }
  return iconClass;
}

export interface IiconContext<T extends string> {
  getIcon: (iconKey: DefaultIconKeys | T) => string;
}

export const IconContext = React.createContext<IiconContext<any>>({
  getIcon: (iconKey) => iconKey,
});

export function IconContextProvider(props: React.PropsWithChildren<{ value: IiconContext<any> }>) {
  return (
    <IconContext.Provider value={props.value}>
      <IconContext.Consumer>
        {(value) => props.value === value ? props.children : null}
      </IconContext.Consumer>
    </IconContext.Provider>
  );
}

export interface IconBaseProps<T> {
  title?: string;
  // 合并默认图标与自定义图标类型
  icon?: DefaultIconKeys | T;
  iconClass?: string;
  tooltip?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

export type IconProp<T> = IconBaseProps<T> & React.HTMLAttributes<HTMLSpanElement>;

/**
 * 在 IDE 集成环境下使用自定义图标时，建议提供自定义 IconKeys 类型
 * @example
 * ```ts
 * const demo = () => (
 *    <Icon<'foo' | 'bar'> icon='bar' />
 * );
 * //自定义前缀
 * const demo = () => (
 *    <Icon<'foo' | 'bar'> iconClass=`${customPrefix} bar` />
 * );
 * ```
 */
export function Icon<T>(
  { size = 'small', loading, icon, iconClass, className, tooltip, disabled, onClick, ...restProps }: IconProp<T>,
): React.ReactElement<IconProp<T>> {
  let iconClx;
  if (icon) {
    if (defaultIconfont[icon as DefaultIconKeys]) {
      iconClx = getDefaultIcon(icon as string);
    } else {
      const { getIcon } = React.useContext(IconContext);
      iconClx = getIcon(icon);
    }
  } else {
    iconClx = iconClass;
  }
  return <span
    {...restProps}
    title={tooltip}
    onClick={onClick}
    className={clx(
      'kt-icon',
      iconClx,
      className,
      {
        'kt-icon-loading': loading,
        'kt-icon-disabled': !!disabled,
        [`kt-icon-${size}`]: !!size,
        'kt-icon-clickable': !!onClick,
      },
    )}
    />;
}
