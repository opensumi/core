import { nls } from '../common';

export default class Messages {
  public static markerTile = () => nls.localize('markers.title', '问题');
  public static markerPanelContentEmpty = () => nls.localize('markers.panel.content.empty', '目前尚未在工作区检测到问题。');
  public static markerPanelFilterInputPlaceholder = () => nls.localize('markers.filter.placefolder', '筛选器，例如：text、**/*.ts、!**/node_modules/**');
  public static markerPanelFilterErrors = () => nls.localize('markers.panel.filter.errors', 'errors');
  public static markerPanelFilterWarnings = () => nls.localize('markers.panel.filter.warnings', 'warnings');
  public static markerPanelFilterInfos = () => nls.localize('markers.panel.filter.infos', 'infos');
  public static markerPanelFilterContentEmpty = () => nls.localize('markers.filter.content.empty', '在给定的筛选条件下，没有找到结果。');
  public static markerPanelFilterReset = () => nls.localize('markers.filter.reset', '清除筛选器');
}
