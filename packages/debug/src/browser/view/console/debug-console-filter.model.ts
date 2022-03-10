import { Injectable } from '@opensumi/di';
import { matchesFuzzy } from '@opensumi/ide-core-common/lib/filters';
import { splitGlobAware } from '@opensumi/ide-core-common/lib/utils/glob';

interface ParsedQuery {
  type: 'include' | 'exclude';
  query: string;
}

@Injectable({ multiple: true })
export class DebugConsoleFilterModel {
  static matchQuery = matchesFuzzy;

  private _parsedQueries: ParsedQuery[] = [];
  set filterQuery(query: string) {
    this._parsedQueries = [];
    query = query.trim();

    if (query && query !== '') {
      const filters = splitGlobAware(query, ',')
        .map((s) => s.trim())
        .filter((s) => !!s.length);
      for (const f of filters) {
        if (f.startsWith('!')) {
          this._parsedQueries.push({ type: 'exclude', query: f.slice(1) });
        } else {
          this._parsedQueries.push({ type: 'include', query: f });
        }
      }
    }
  }

  filter(text: string): boolean {
    let includeQueryPresent = false;
    let includeQueryMatched = false;

    for (const { type, query } of this._parsedQueries) {
      if (type === 'exclude' && DebugConsoleFilterModel.matchQuery(query, text)) {
        return false;
      } else if (type === 'include') {
        includeQueryPresent = true;
        if (DebugConsoleFilterModel.matchQuery(query, text)) {
          includeQueryMatched = true;
        }
      }
    }

    return includeQueryPresent && includeQueryMatched;
  }
}
