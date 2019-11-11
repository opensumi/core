import { nls } from '../common';

export default class Messages {

  public static MARKERS_PANEL_CONTENT_EMPTY: string = nls.localize('markers.panel.content.empty', '目前尚未在工作区检测到问题。');

  public static MARKERS_PANEL_FILTER_INPUT_PLACEHOLDER: string = nls.localize('markers.filter.placefolder', '筛选器，例如：text、**/*.ts、!**/node_modules/**');
  public static MARKERS_PANEL_FILTER_ERRORS: string = nls.localize('markers.panel.filter.errors', 'errors');
  public static MARKERS_PANEL_FILTER_WARNINGS: string = nls.localize('markers.panel.filter.warnings', 'warnings');
  public static MARKERS_PANEL_FILTER_INFOS: string = nls.localize('markers.panel.filter.infos', 'infos');

  public static MARKERS_PANEL_FILTER_CONTENT_EMPTY: string = nls.localize('markers.filter.content.empty', '在给定的筛选条件下，没有找到结果。');
  public static MARKERS_PANEL_FILTER_RESET: string = nls.localize('markers.filter.reset', '清除筛选器');

}
