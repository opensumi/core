
import { IMarker, MarkerSeverity, ResourceGlobMatcher, URI } from '@ali/ide-core-common';
import { IFilter, matchesFuzzy, matchesFuzzy2, matchesPrefix } from '@ali/ide-core-common/lib/filters';
import { getEmptyExpression, IExpression, splitGlobAware } from '@ali/ide-core-common/lib/glob';
import * as strings from '@ali/ide-core-common/lib/strings';
import { IFilterOptions, IMarkerModel, IFilterMatches, IFilterMarkerItem } from '../common';
import Messages from './messages';

export class FilterOptions implements IFilterOptions {
  static readonly _filter: IFilter = matchesFuzzy2;
  static readonly _messageFilter: IFilter = matchesFuzzy;

  readonly filterErrors: boolean = false;
  readonly filterWarnings: boolean = false;
  readonly filterInfos: boolean = false;
  readonly textFilter: string = '';
  readonly excludesMatcher: ResourceGlobMatcher;
  readonly includesMatcher: ResourceGlobMatcher;

  constructor(readonly filter: string = '', filesExclude: { root: URI, expression: IExpression }[] | IExpression = []) {
    filter = filter.trim();

    const filesExcludeByRoot = Array.isArray(filesExclude) ? filesExclude : [];
    const excludesExpression: IExpression = Array.isArray(filesExclude) ? getEmptyExpression() : filesExclude;

    const includeExpression: IExpression = getEmptyExpression();
    if (filter) {
      const filters = splitGlobAware(filter, ',').map((s) => s.trim()).filter((s) => !!s.length);
      for (const f of filters) {
        this.filterErrors = this.filterErrors || this.matches(f, Messages.MARKERS_PANEL_FILTER_ERRORS);
        this.filterWarnings = this.filterWarnings || this.matches(f, Messages.MARKERS_PANEL_FILTER_WARNINGS);
        this.filterInfos = this.filterInfos || this.matches(f, Messages.MARKERS_PANEL_FILTER_INFOS);
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

interface IFilterMarkerModel {
  match: boolean;
  data: IMarkerModel;
  matches?: IFilterMatches;
  children?: IFilterMarkerItem [];
}

export class FilterMarkerModel implements IFilterMarkerModel, IMarkerModel {
  constructor(
    public match: boolean = true,
    public data: IMarkerModel,
    public children: IFilterMarkerItem[],
    public matches?: IFilterMatches,
  ) { }

  get uri() {
    return this.data.uri;
  }

  get icon() {
    return this.data.icon;
  }

  get filename() {
    return this.data.filename;
  }

  get longname() {
    return this.data.longname;
  }

  get markers(): IFilterMarkerItem[] {
    return this.children;
  }

  public size() {
    let count = 0;
    if (this.children.length > 0) {
      this.children.forEach((child) => {
        if (child.match) {
          count = count + 1;
        }
      });
    }
    return count;
  }

  public hasChildren() {
    return this.children && this.children.length > 0;
  }
}

export class FilterMarkerItem implements IFilterMarkerItem {
  constructor(
    public match: boolean = true,
    public data: IMarker,
    public matches?: IFilterMatches,
  ) { }

  get type() {
    return this.data.type;
  }

  get resource() {
    return this.data.resource;
  }

  get code() {
    return this.data.code;
  }

  get severity() {
    return this.data.severity;
  }

  get message() {
    return this.data.message;
  }

  get source() {
    return this.data.source;
  }

  get startLineNumber() {
    return this.data.startLineNumber;
  }

  get endLineNumber() {
    return this.data.endLineNumber;
  }

  get startColumn() {
    return this.data.startColumn;
  }

  get endColumn() {
    return this.data.endColumn;
  }

  get relatedInformation() {
    return this.data.relatedInformation;
  }

  get tags() {
    return this.data.tags;
  }
}

export class Filter {

  constructor(public options: FilterOptions) { }

  public filterModel(model: IMarkerModel): FilterMarkerModel {
    const children = this.filterMarkerItems(model.markers);
    const filenameMatches = model.filename ? FilterOptions._filter(this.options.textFilter, model.filename) : undefined;
    const match = (filenameMatches && filenameMatches.length > 0) || children.length > 0;
    return new FilterMarkerModel(match, model, children, match ? { filenameMatches } : undefined);
  }

  private filterMarkerItems(markers: IMarker[]): IFilterMarkerItem[] {
    if (!markers || markers.length <= 0) { return []; }
    const result: IFilterMarkerItem[] = markers.map((marker) => {
      return this.filterMarkerItem(marker);
    });
    return result.filter((model: IFilterMarkerItem) => {
      return model.match === true;
    });
  }

  private filterMarkerItem(marker: IMarker): IFilterMarkerItem {
    if (this.options.filterErrors && MarkerSeverity.Error === marker.severity
      || this.options.filterWarnings && MarkerSeverity.Warning === marker.severity
      || this.options.filterInfos && MarkerSeverity.Info === marker.severity
      || !this.options.textFilter) {
      return new FilterMarkerItem(true, marker);
    }

    const messageMatches = marker.message ? FilterOptions._filter(this.options.textFilter, marker.message) : undefined;
    const sourceMatches = marker.source ? FilterOptions._filter(this.options.textFilter, marker.source) : undefined;
    const codeMatches = marker.code ? FilterOptions._filter(this.options.textFilter, marker.code) : undefined;

    if (messageMatches || sourceMatches || codeMatches) {
      return new FilterMarkerItem(true, marker, {
        messageMatches,
        sourceMatches,
        codeMatches,
      });
    } else {
      return new FilterMarkerItem(false, marker);
    }
  }
}
