import { ITheme } from './theme.service';

export const ThemeContributionProvider = Symbol('ThemeContributionProvider');
export interface ThemeContributionProvider {
  onWillApplyTheme?(theme: ITheme): Record<string, string | undefined>;
}
