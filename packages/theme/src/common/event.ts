import { BasicEvent } from '@ali/ide-core-browser';
import { ITheme } from './theme.service';

export class ThemeChangedEvent extends BasicEvent<IThemeChangedEventPayload> {}

export interface IThemeChangedEventPayload {
  theme: ITheme;
}
