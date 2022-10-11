import { Event } from '@opensumi/ide-core-browser';
export const IElectronHeaderService = Symbol('IElectronHeaderService');

export interface IElectronHeaderService {
  titleTemplate: string;
  appTitle: string;
  onTitleChanged: Event<string>;
}
