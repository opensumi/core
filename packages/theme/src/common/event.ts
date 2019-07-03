import { BasicEvent } from '@ali/ide-core-browser';
import { ThemeMix } from './theme.service';

export class ThemeChangedEvent extends BasicEvent<IThemeChangedEventPayload> {}

export interface IThemeChangedEventPayload {
  themeData: ThemeMix;
}
