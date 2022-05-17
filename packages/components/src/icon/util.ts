import { iconManager } from './iconfont/iconManager';

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

export function updateIconMap(prefix: string, customIconMap: { [iconKey: string]: string }) {
  iconManager.update(prefix, customIconMap);
}

export interface IIconShapeOptions {
  rotate?: ROTATE_TYPE;
  anim?: ANIM_TYPE;
  fill?: boolean;
}

export function getIconShapeClxList(options?: IIconShapeOptions): string[] {
  const { rotate, anim, fill } = options || {};
  const iconClassList: string[] = [];

  if (rotate !== undefined) {
    iconClassList.push(`iconfont-${ROTATE_CLASS_NAME[rotate]}`);
  }
  if (anim !== undefined) {
    iconClassList.push(`iconfont-anim-${ANIM_CLASS_NAME[anim]}`);
  }
  if (fill) {
    iconClassList.push('toggled');
  }

  return iconClassList;
}

/**
 * 获取 icon className
 * @param iconKey
 * @param options
 * @return 获取拼接好的 className，如果拿不到则返回空字符串
 */
export function getIcon(iconKey: string, options?: IIconShapeOptions): string {
  const iconClassList = iconManager.getIconClx(iconKey);
  const iconShapeClxList = getIconShapeClxList(options);
  iconClassList.push(...iconShapeClxList);
  return iconClassList.join(' ');
}

export const getKaitianIcon = getIcon;
export const updateKaitianIconMap = updateIconMap;
