import { SymbolKind, getLogger } from '@ali/ide-core-common';
import { warning } from '@ali/ide-core-common/lib/utils/warning';

import { IDE_ICONFONT_CN_CSS } from './ide-iconfont';
import iconfontMap from './iconfont/iconMap';

export const DEFAULT_CDN_ICON = IDE_ICONFONT_CN_CSS;

const iconPrefixes = ['kaitian-icon kticon-'];

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

/**
 * 获取 icon className
 * @param iconKey
 * @param options
 * @return 获取拼接好的 className，如果拿不到则返回空字符串
 */
export function getIcon(iconKey: string, options?: {
  rotate?: ROTATE_TYPE;
  anim?: ANIM_TYPE;
  fill?: boolean;
}): string {
  const {rotate, anim, fill} = options || {};
  let lastIndex = iconPrefixes.length;
  while (!iconMap[iconPrefixes[--lastIndex]][iconKey]) {
    if (lastIndex === 0) { break; }
  }
  const iconValue = iconMap[iconPrefixes[lastIndex]][iconKey];
  if (!iconValue) {
    getLogger().warn('图标库缺失图标:' + iconKey);
    return '';
  }

  let iconClass = `${iconPrefixes[lastIndex]}${iconValue}`;
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

export function getOctIcon(iconKey: string) {
  return `octicon octicon-${iconKey}`;
}

export function updateIconMap(prefix: string, customIconMap: { [iconKey: string]: string }) {
  iconMap[prefix] = customIconMap;
  iconPrefixes.push(prefix);
}

// key 为 iconName enum, value 为 icon className
const typoIconMap = {
  'folder-fill-open': 'folder-fill',
  'search-close': 'close-square',
  'fold': 'collapse-all',
  'setting-general': 'setting',
  'setting-editor': 'codelibrary-fill',
  'setting-file': 'file-text',
  'setting-extension': 'extension',
  'run-debug': 'rundebug',
  'toggle-breakpoints': 'deactivate-breakpoints',
  // new typos issue
  'withdraw': 'fallback',
  'terminate1': 'terminate',
  'stop1': 'stop',
  'add': 'plus',
};

const _defaultIconMap = Object.assign({}, iconfontMap, typoIconMap);

export const defaultIconMap = new Proxy(_defaultIconMap, {
  get(obj, prop: string) {
    const typoValue = typoIconMap[prop];
    warning(!typoValue, `Icon '${prop}' was a typo, please use '${typoValue}' instead`);
    return obj[prop];
  },
});

const iconMap: { [iconPrefix: string]: { [iconKey: string]: string } } = {
  [iconPrefixes[0]]: defaultIconMap,
};

/**
 * @internal
 */
export const getSymbolIcon = (() => {

  const _fromMapping: { [n: number]: string } = Object.create(null);
  _fromMapping[SymbolKind.File] = 'file';
  _fromMapping[SymbolKind.Module] = 'module';
  _fromMapping[SymbolKind.Namespace] = 'namespace';
  _fromMapping[SymbolKind.Package] = 'package';
  _fromMapping[SymbolKind.Class] = 'class';
  _fromMapping[SymbolKind.Method] = 'method';
  _fromMapping[SymbolKind.Property] = 'property';
  _fromMapping[SymbolKind.Field] = 'field';
  _fromMapping[SymbolKind.Constructor] = 'constructor';
  _fromMapping[SymbolKind.Enum] = 'enum';
  _fromMapping[SymbolKind.Interface] = 'interface';
  _fromMapping[SymbolKind.Function] = 'function';
  _fromMapping[SymbolKind.Variable] = 'variable';
  _fromMapping[SymbolKind.Constant] = 'constant';
  _fromMapping[SymbolKind.String] = 'string';
  _fromMapping[SymbolKind.Number] = 'number';
  _fromMapping[SymbolKind.Boolean] = 'boolean';
  _fromMapping[SymbolKind.Array] = 'array';
  _fromMapping[SymbolKind.Object] = 'object';
  _fromMapping[SymbolKind.Key] = 'key';
  _fromMapping[SymbolKind.Null] = 'null';
  _fromMapping[SymbolKind.EnumMember] = 'enum-member';
  _fromMapping[SymbolKind.Struct] = 'struct';
  _fromMapping[SymbolKind.Event] = 'event';
  _fromMapping[SymbolKind.Operator] = 'operator';
  _fromMapping[SymbolKind.TypeParameter] = 'type-parameter';

  return function toCssClassName(kind: SymbolKind, inline?: boolean): string {
    return `symbol-icon ${inline ? 'inline' : 'block'} ${_fromMapping[kind] || 'property'}`;
  };
})();
