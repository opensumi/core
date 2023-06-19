import { localize } from '@opensumi/ide-core-browser';

export default class Messages {
  public static markerTitle = () => localize('markers.title');
  public static markerPanelContentEmpty = () => localize('markers.panel.content.empty');
  public static markerPanelFilterInputPlaceholder = () => localize('markers.filter.placeholder');
  public static markerPanelFilterErrors = () => localize('markers.panel.filter.errors', 'errors');
  public static markerPanelFilterWarnings = () => localize('markers.panel.filter.warnings', 'warnings');
  public static markerPanelFilterInfos = () => localize('markers.panel.filter.infos', 'infos');
  public static markerPanelFilterContentEmpty = () => localize('markers.filter.content.empty');
  public static markerPanelFilterReset = () => localize('markers.filter.reset');
}
