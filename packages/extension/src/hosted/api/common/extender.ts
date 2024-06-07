import { IExtensionDescription } from '../../../common/vscode';

export interface APIExtender<T> {
  extend(extension: IExtensionDescription, data: T): T;
}

export function applyExtenders<T>(extension: IExtensionDescription, extenders: APIExtender<T>[], _data: T) {
  for (const extender of extenders) {
    _data = extender.extend(extension, _data);
  }

  return _data;
}
