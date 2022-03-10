import { IMarker, MarkerSeverity, URI } from '@opensumi/ide-core-common';
import { IFilter, matchesFuzzy, matchesFuzzy2, matchesPrefix } from '@opensumi/ide-core-common/lib/filters';
import { getEmptyExpression, IExpression, splitGlobAware } from '@opensumi/ide-core-common/lib/utils/glob';
import * as strings from '@opensumi/ide-core-common/lib/utils/strings';

import {
  IFilterOptions,
  IRenderableMarker,
  IRenderableMarkerModel,
  MarkerItemBuilder,
  MarkerModelBuilder,
  ResourceGlobMatcher,
} from '../common';

import Messages from './messages';

/**
 * marker 过滤选项
 * - 过滤严重程度
 * - 过滤文案
 */
export class FilterOptions implements IFilterOptions {
  static readonly _filter: IFilter = matchesFuzzy2;
  static readonly _messageFilter: IFilter = matchesFuzzy;

  readonly filterErrors: boolean = false;
  readonly filterWarnings: boolean = false;
  readonly filterInfos: boolean = false;
  readonly textFilter: string = '';
  readonly excludesMatcher: ResourceGlobMatcher;
  readonly includesMatcher: ResourceGlobMatcher;

  constructor(readonly filter: string = '', filesExclude: { root: URI; expression: IExpression }[] | IExpression = []) {
    filter = filter.trim();

    const filesExcludeByRoot = Array.isArray(filesExclude) ? filesExclude : [];
    const excludesExpression: IExpression = Array.isArray(filesExclude) ? getEmptyExpression() : filesExclude;

    const includeExpression: IExpression = getEmptyExpression();
    if (filter) {
      const filters = splitGlobAware(filter, ',')
        .map((s) => s.trim())
        .filter((s) => !!s.length);
      for (const f of filters) {
        this.filterErrors = this.filterErrors || this.matches(f, Messages.markerPanelFilterErrors());
        this.filterWarnings = this.filterWarnings || this.matches(f, Messages.markerPanelFilterWarnings());
        this.filterInfos = this.filterInfos || this.matches(f, Messages.markerPanelFilterInfos());
        if (strings.startsWith(f, '!')) {
          this.setPattern(excludesExpression, strings.ltrim(f, '!'));
        } else {
          this.setPattern(includeExpression, f);
          this.textFilter += ` ${f}`;
        }
      }
    }

    this.excludesMatcher = new ResourceGlobMatcher(excludesExpression, filesExcludeByRoot);
    this.includesMatcher = new ResourceGlobMatcher(includeExpression, []);
    this.textFilter = this.textFilter.trim();
  }

  private setPattern(expression: IExpression, pattern: string) {
    if (pattern[0] === '.') {
      pattern = '*' + pattern; // convert ".js" to "*.js"
    }
    expression[`**/${pattern}/**`] = true;
    expression[`**/${pattern}`] = true;
  }

  private matches(prefix: string, word: string): boolean {
    const result = matchesPrefix(prefix, word);
    return !!(result && result.length > 0);
  }
}

/**
 * Marker Filter
 * - 模糊匹配 marker model
 *  - 匹配 filename
 * - 模糊匹配 marker item
 *  - 匹配 message
 *  - 匹配 srouce
 *  - 匹配 code
 */
export class Filter {
  constructor(public options: FilterOptions) {}

  public filterModel(model: IRenderableMarkerModel): IRenderableMarkerModel {
    const includeMatch = this.options.includesMatcher.matches(new URI(model.resource));
    const filenameMatches = model.filename ? FilterOptions._filter(this.options.textFilter, model.filename) : undefined;
    const parentMatch = includeMatch || (filenameMatches && filenameMatches.length > 0);
    if (parentMatch) {
      return MarkerModelBuilder.buildFilterModel(
        model,
        this.filterMarkerItems(model.markers, false),
        parentMatch,
        true,
        { filenameMatches },
      );
    } else {
      const markers = this.filterMarkerItems(model.markers, true);
      return MarkerModelBuilder.buildFilterModel(model, markers, false, markers.length > 0);
    }
  }

  private filterMarkerItems(markers: IMarker[], filterCount: boolean): IRenderableMarker[] {
    if (!markers || markers.length <= 0) {
      return [];
    }
    const result: IRenderableMarker[] = markers.map((marker) => this.filterMarkerItem(marker));
    if (filterCount) {
      return result.filter((model: IRenderableMarker) => model.match === true);
    } else {
      return result;
    }
  }

  private filterMarkerItem(marker: IMarker): IRenderableMarker {
    if (
      (this.options.filterErrors && MarkerSeverity.Error === marker.severity) ||
      (this.options.filterWarnings && MarkerSeverity.Warning === marker.severity) ||
      (this.options.filterInfos && MarkerSeverity.Info === marker.severity) ||
      !this.options.textFilter
    ) {
      return MarkerItemBuilder.buildFilterItem(marker, true);
    }

    const messageMatches = marker.message ? FilterOptions._filter(this.options.textFilter, marker.message) : undefined;
    const sourceMatches = marker.source ? FilterOptions._filter(this.options.textFilter, marker.source) : undefined;
    const codeMatches = marker.code ? FilterOptions._filter(this.options.textFilter, marker.code) : undefined;

    if (messageMatches || sourceMatches || codeMatches) {
      return MarkerItemBuilder.buildFilterItem(marker, true, {
        messageMatches,
        sourceMatches,
        codeMatches,
      });
    } else {
      return MarkerItemBuilder.buildFilterItem(marker, false);
    }
  }
}
