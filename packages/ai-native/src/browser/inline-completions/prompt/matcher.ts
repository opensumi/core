import {
  CursorContext,
  MatchSimilarSnippet,
  ResourceDocument,
  SimilarSnippet,
  SnippetSelectionOption,
  SnippetSemantics,
  SortOption,
} from '../types';

export class TokensCache {
  private readonly size: number;

  private readonly keys: string[] = [];

  private readonly cache: {
    [key: string]: Set<string>[];
  } = {};

  constructor(size: number) {
    this.size = size;
  }

  put(id: string, tokens: Set<string>[]) {
    this.cache[id] = tokens;
    if (!this.keys.includes(id)) {
      this.keys.push(id);
    }
    if (this.keys.length > this.size) {
      const key = this.keys.shift() ?? '';
      delete this.cache[key];
    }
  }

  get(id: string) {
    return this.cache[id];
  }
}

const englishStopWords = new Set([
  'we',
  'our',
  'you',
  'it',
  'its',
  'they',
  'them',
  'their',
  'this',
  'that',
  'these',
  'those',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'can',
  'don',
  't',
  's',
  'will',
  'would',
  'should',
  'what',
  'which',
  'who',
  'when',
  'where',
  'why',
  'how',
  'a',
  'an',
  'the',
  'and',
  'or',
  'not',
  'no',
  'but',
  'because',
  'as',
  'until',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'above',
  'below',
  'to',
  'during',
  'before',
  'after',
  'of',
  'at',
  'by',
  'about',
  'between',
  'into',
  'through',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'now',
]);
const programmingStopWords = new Set([
  'if',
  'then',
  'else',
  'for',
  'while',
  'with',
  'def',
  'function',
  'return',
  'TODO',
  'import',
  'try',
  'catch',
  'raise',
  'finally',
  'repeat',
  'switch',
  'case',
  'match',
  'assert',
  'continue',
  'break',
  'const',
  'class',
  'enum',
  'struct',
  'static',
  'new',
  'super',
  'this',
  'var',
]);
const allStopWords = new Set([...englishStopWords, ...programmingStopWords]);

const languageStopWords = new Map();

function splitIntoWords(text: string) {
  return text.split(/[^a-zA-Z0-9]/).filter((word: string) => word.length > 0);
}

class DocumentTokenizer {
  private readonly stopsForLanguage: Set<string>;

  constructor(resource: ResourceDocument) {
    this.stopsForLanguage = languageStopWords.get(resource.languageId) ?? allStopWords;
  }

  tokenize(text: string) {
    return new Set(splitIntoWords(text).filter((word) => !this.stopsForLanguage.has(word)));
  }
}

const tokensCache = new TokensCache(20);

export abstract class WindowedMatcher {
  private referenceDoc: ResourceDocument;

  private tokenizer: DocumentTokenizer;

  abstract getCursorContextInfo(doc: ResourceDocument): CursorContext;
  abstract getWindowsDelineations(lines: string[]): [number, number][];
  abstract similarityScore(tokens1: Set<string>, tokens2: Set<string>): number;
  abstract id(): string;

  private referenceTokensCache?: Set<string>;

  constructor(doc: ResourceDocument) {
    this.referenceDoc = doc;
    this.tokenizer = new DocumentTokenizer(doc);
  }

  get referenceTokens() {
    if (!this.referenceTokensCache) {
      this.referenceTokensCache = new Set(
        this.tokenizer.tokenize(this.getCursorContextInfo(this.referenceDoc).context),
      );
    }
    return this.referenceTokensCache;
  }

  sortScoredSnippets(snippets: SimilarSnippet[], sortRule = SortOption.Descending) {
    // eslint-disable-next-line no-nested-ternary
    return sortRule === SortOption.Ascending
      ? snippets.sort((snippet1, snippet2) => (snippet1.score > snippet2.score ? 1 : -1))
      : sortRule === SortOption.Descending
      ? snippets.sort((snippet1, snippet2) => (snippet1.score > snippet2.score ? -1 : 1))
      : snippets;
  }

  retrieveAllSnippets(resource: ResourceDocument, sortRule = SortOption.Descending) {
    const snippets: SimilarSnippet[] = [];
    if (!resource.source.length || !this.referenceTokens.size) {
      return snippets;
    }
    const sourceArray = resource.source.split('\n');
    const key = `${this.id()}:${resource.source}`;
    const cache: Set<string>[] = tokensCache.get(key) ?? [];
    const noCache = !cache.length;
    const tokens = noCache ? sourceArray.map((text) => this.tokenizer.tokenize(text), this.tokenizer) : [];
    for (const [index, [startLine, endLine]] of this.getWindowsDelineations(sourceArray).entries()) {
      if (noCache) {
        const size: Set<string> = new Set();
        tokens.slice(startLine, endLine).forEach((token) => token.forEach((word) => size.add(word)));
        cache.push(size);
      }
      const traget = cache[index];
      const score = this.similarityScore(traget, this.referenceTokens);
      snippets.push({
        score,
        startLine,
        endLine,
      });
    }
    if (noCache) {
      tokensCache.put(key, cache);
    }
    return this.sortScoredSnippets(snippets, sortRule);
  }

  findMatches(
    resource: ResourceDocument,
    mode = SnippetSelectionOption.BestMatch,
    size?: number,
  ): MatchSimilarSnippet[] | undefined {
    if (mode === SnippetSelectionOption.BestMatch) {
      const snippet = this.findBestMatch(resource);
      return snippet ? [snippet] : [];
    }
    return mode === SnippetSelectionOption.TopK ? this.findTopKMatches(resource, size) : [];
  }

  /**
   * 获取所有匹配的片段
   * @param resource 文档资源
   */
  findBestMatch(resource: ResourceDocument) {
    if (!resource.source.length || !this.referenceTokens.size) {
      return;
    }
    const lines = resource.source.split('\n');
    const snippets = this.retrieveAllSnippets(resource, SortOption.Descending);
    return snippets.length !== 0 && snippets[0].score !== 0
      ? {
          snippet: lines.slice(snippets[0].startLine, snippets[0].endLine).join('\n'),
          semantics: SnippetSemantics.Snippet,
          ...snippets[0],
        }
      : null;
  }

  /**
   * 获取最高匹配片段
   * @param resource 文档资源
   * @param size 取前几位，默认取前一位
   */
  findTopKMatches(resource: ResourceDocument, size = 1): MatchSimilarSnippet[] | undefined {
    if (!resource.source.length || !this.referenceTokens.size || size < 1) {
      return;
    }
    const lines = resource.source.split('\n');
    const snippets = this.retrieveAllSnippets(resource, SortOption.Descending);
    if (!snippets.length || !snippets[0].score) {
      return;
    }
    const topSnippets = [snippets[0]];
    for (let i = 1; i < snippets.length && topSnippets.length < size; i++) {
      if (topSnippets.findIndex((t) => snippets[i].startLine < t.endLine && snippets[i].endLine > t.startLine) === -1) {
        topSnippets.push(snippets[i]);
      }
    }
    return topSnippets.map((snippet) => ({
      snippet: lines.slice(snippet.startLine, snippet.endLine).join('\n'),
      semantics: SnippetSemantics.Snippet,
      ...snippet,
    }));
  }
}

export function computeScore(set1: Set<string>, set2: Set<string>) {
  let intersectionSize = 0;
  for (const element of set1) {
    if (set2.has(element)) {
      intersectionSize++;
    }
  }
  return intersectionSize / (set1.size + set2.size - intersectionSize);
}
