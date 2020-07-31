import { SymbolKind } from '@ali/ide-core-common';
import { updateKaitianIconMap, getKaitianIcon } from '@ali/ide-components/lib/icon';

import { IDE_ICONFONT_CN_CSS } from './ide-iconfont';

export const DEFAULT_CDN_ICON = IDE_ICONFONT_CN_CSS;

export const getIcon = getKaitianIcon;
export const updateIconMap = updateKaitianIconMap;

export function getOctIcon(iconKey: string) {
  return `octicon octicon-${iconKey}`;
}

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
