import { localize } from '@opensumi/ide-core-browser';

export default class Messages {
  public static markerTitle = () => localize('markers.title', '问题');
  public static markerPanelContentEmpty = () => localize('markers.panel.content.empty', '目前尚未在工作区检测到问题。');
  public static markerPanelFilterInputPlaceholder = () =>
    localize('markers.filter.placeholder', '筛选器，例如：text、**/*.ts、!**/node_modules/**');
  public static markerPanelFilterErrors = () => localize('markers.panel.filter.errors', 'errors');
  public static markerPanelFilterWarnings = () => localize('markers.panel.filter.warnings', 'warnings');
  public static markerPanelFilterInfos = () => localize('markers.panel.filter.infos', 'infos');
  public static markerPanelFilterContentEmpty = () =>
    localize('markers.filter.content.empty', '在给定的筛选条件下，没有找到结果。');
  public static markerPanelFilterReset = () => localize('markers.filter.reset', '清除筛选器');
}
