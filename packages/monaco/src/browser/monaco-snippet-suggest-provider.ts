import * as jsoncparser from 'jsonc-parser';

import { Injectable, Autowired } from '@opensumi/di';
import {
  IRange,
  Uri,
  localize,
  ILogger,
  Disposable,
  IDisposable,
  DisposableCollection,
} from '@opensumi/ide-core-common';
import { isPatternInWord } from '@opensumi/ide-core-common/lib/filters';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { SnippetParser } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/snippet/snippetParser';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { ITextModel } from './monaco-api/types';

@Injectable()
export class MonacoSnippetSuggestProvider implements monaco.languages.CompletionItemProvider {
  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  protected readonly snippets = new Map<string, Snippet[]>();
  protected readonly pendingSnippets = new Map<string, Promise<void>[]>();

  private static readonly _maxPrefix = 10000;

  get registeredLanguageIds() {
    const allLanguageIds: string[] = [];
    this.pendingSnippets.forEach((_, key) => {
      if (key !== '*') {
        allLanguageIds.push(key);
      }
    });
    return allLanguageIds;
  }

  async provideCompletionItems(
    model: ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext,
    token: monaco.CancellationToken,
  ): Promise<monaco.languages.CompletionList | undefined> {
    if (position.column >= MonacoSnippetSuggestProvider._maxPrefix) {
      // 如果单行过长则忽略
      return undefined;
    }

    if (
      context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter &&
      context.triggerCharacter === ' '
    ) {
      // 如果通过空格触发则忽略
      return undefined;
    }
    // TODO embed languageId, get languageId at position
    const languageId = model.getModeId();
    await this.loadSnippets(languageId);
    const languageSnippets = this.snippets.get(languageId) || [];
    const pos = { lineNumber: position.lineNumber, column: 1 };
    const lineOffsets: number[] = [];
    const lineContent = model.getLineContent(position.lineNumber);
    const linePrefixLow = lineContent.substr(0, position.column - 1).toLowerCase();
    const endsInWhitespace = linePrefixLow.match(/\s$/);

    // 从待补全位置往前遍历该行，找出特殊节点
    while (pos.column < position.column) {
      const word = model.getWordAtPosition(pos);
      if (word) {
        // at a word
        lineOffsets.push(word.startColumn - 1);
        pos.column = word.endColumn + 1;
        if (word.endColumn - 1 < linePrefixLow.length && !/\s/.test(linePrefixLow[word.endColumn - 1])) {
          lineOffsets.push(word.endColumn - 1);
        }
      } else if (!/\s/.test(linePrefixLow[pos.column - 1])) {
        // at a none-whitespace character
        lineOffsets.push(pos.column - 1);
        pos.column += 1;
      } else {
        // always advance!
        pos.column += 1;
      }
    }

    const availableSnippets = new Set<Snippet>();
    languageSnippets.forEach(availableSnippets.add, availableSnippets);
    const suggestions: MonacoSnippetSuggestion[] = [];
    for (const start of lineOffsets) {
      availableSnippets.forEach((snippet) => {
        // 对于特殊节点需要处理一下range
        if (
          isPatternInWord(
            linePrefixLow,
            start,
            linePrefixLow.length,
            snippet.prefix.toLowerCase(),
            0,
            snippet.prefix.length,
          )
        ) {
          suggestions.push(
            new MonacoSnippetSuggestion(
              snippet,
              monaco.Range.fromPositions(position.delta(0, -(linePrefixLow.length - start)), position),
            ),
          );
          availableSnippets.delete(snippet);
        }
      });
    }
    if (endsInWhitespace || lineOffsets.length === 0) {
      // add remaing snippets when the current prefix ends in whitespace or when no
      // interesting positions have been found
      availableSnippets.forEach((snippet) => {
        suggestions.push(new MonacoSnippetSuggestion(snippet, monaco.Range.fromPositions(position)));
      });
    }
    suggestions.sort(MonacoSnippetSuggestion.compareByLabel);
    for (let i = 0; i < suggestions.length; i++) {
      const item = suggestions[i];
      let to = i + 1;
      for (; to < suggestions.length && item.label === suggestions[to].label; to++) {
        suggestions[to].label = localize(
          'snippetSuggest.longLabel',
          suggestions[to].label,
          suggestions[to].snippet.name,
        );
      }
      if (to > i + 1) {
        suggestions[i].label = localize('snippetSuggest.longLabel', suggestions[i].label, suggestions[i].snippet.name);
        i = to;
      }
    }
    return { suggestions };
  }

  resolveCompletionItem(item: monaco.languages.CompletionItem, token: monaco.CancellationToken) {
    return Promise.resolve(item);
  }

  protected async loadSnippets(scope: string): Promise<void> {
    const pending: Promise<void>[] = [];
    pending.push(...(this.pendingSnippets.get(scope) || []));
    pending.push(...(this.pendingSnippets.get('*') || []));
    if (pending.length) {
      await Promise.all(pending);
    }
  }

  fromPath(path: string, options: SnippetLoadOptions): IDisposable {
    const toDispose = new DisposableCollection(
      Disposable.create(() => {
        /* mark as not disposed */
      }),
    );
    const snippetPath = new Path(options.extPath).join(path.replace(/^\.\//, '')).toString();
    const pending = this.loadURI(Uri.file(snippetPath), options, toDispose);
    const { language } = options;
    const scopes = Array.isArray(language) ? language : language ? [language] : ['*'];
    for (const scope of scopes) {
      const pendingSnippets = this.pendingSnippets.get(scope) || [];
      pendingSnippets.push(pending);
      this.pendingSnippets.set(scope, pendingSnippets);

      toDispose.push(
        Disposable.create(() => {
          const index = pendingSnippets.indexOf(pending);
          if (index !== -1) {
            pendingSnippets.splice(index, 1);
          }

          this.pendingSnippets.delete(scope);
        }),
      );
    }

    return toDispose;
  }
  /**
   * should NOT throw to prevent load erros on suggest
   */
  protected async loadURI(
    uri: string | Uri,
    options: SnippetLoadOptions,
    toDispose: DisposableCollection,
  ): Promise<void> {
    try {
      const { content } = await this.filesystem.resolveContent(uri.toString(), { encoding: 'utf-8' });
      if (toDispose.disposed) {
        return;
      }

      const snippets = content && jsoncparser.parse(content, undefined, { disallowComments: false });
      toDispose.push(this.fromJSON(snippets, options));
    } catch (e) {
      this.logger.error(e);
    }
  }

  protected fromJSON(
    snippets: JsonSerializedSnippets | undefined,
    { language, source }: SnippetLoadOptions,
  ): IDisposable {
    const toDispose = new DisposableCollection();

    this.parseSnippets(snippets, (name, snippet) => {
      let { prefix, body, description } = snippet;
      if (Array.isArray(body)) {
        body = body.join('\n');
      }
      if (typeof prefix !== 'string' || typeof body !== 'string') {
        return;
      }
      const scopes: string[] = [];
      if (language) {
        if (Array.isArray(language)) {
          scopes.push(...language);
        } else {
          scopes.push(language);
        }
      } else if (typeof snippet.scope === 'string') {
        for (const rawScope of snippet.scope.split(',')) {
          const scope = rawScope.trim();
          if (scope) {
            scopes.push(scope);
          }
        }
      }
      toDispose.push(
        this.push({
          scopes,
          name,
          prefix,
          description,
          body,
          source,
        }),
      );
    });

    return toDispose;
  }
  protected parseSnippets(
    snippets: JsonSerializedSnippets | undefined,
    accept: (name: string, snippet: JsonSerializedSnippet) => void,
  ): void {
    if (typeof snippets === 'object') {
      // eslint-disable-next-line guard-for-in
      for (const name in snippets) {
        const scopeOrTemplate = snippets[name];
        if (JsonSerializedSnippet.is(scopeOrTemplate)) {
          accept(name, scopeOrTemplate);
        } else {
          this.parseSnippets(scopeOrTemplate, accept);
        }
      }
    }
  }

  push(...snippets: Snippet[]): IDisposable {
    const toDispose = new DisposableCollection();

    for (const snippet of snippets) {
      for (const scope of snippet.scopes) {
        const languageSnippets = this.snippets.get(scope) || [];
        languageSnippets.push(snippet);
        this.snippets.set(scope, languageSnippets);

        toDispose.push(
          Disposable.create(() => {
            const index = languageSnippets.indexOf(snippet);
            if (index !== -1) {
              languageSnippets.splice(index, 1);
              this.snippets.delete(scope);
            }
          }),
        );
      }
    }

    return toDispose;
  }
}

export interface SnippetLoadOptions {
  language?: string | string[];
  source: string;
  extPath: string;
}

export interface JsonSerializedSnippets {
  [name: string]: JsonSerializedSnippet | { [name: string]: JsonSerializedSnippet };
}
export interface JsonSerializedSnippet {
  body: string | string[];
  scope: string;
  prefix: string;
  description: string;
}
export namespace JsonSerializedSnippet {
  export function is(obj: Object | undefined): obj is JsonSerializedSnippet {
    return typeof obj === 'object' && 'body' in obj && 'prefix' in obj;
  }
}

export interface Snippet {
  readonly scopes: string[];
  readonly name: string;
  readonly prefix: string;
  readonly description: string;
  readonly body: string;
  readonly source: string;
}

export class MonacoSnippetSuggestion implements monaco.languages.CompletionItem {
  label: string;
  readonly detail: string;
  readonly sortText: string;
  readonly noAutoAccept = true;
  readonly type: 'snippet' = 'snippet';
  readonly snippetType: 'textmate' = 'textmate';
  readonly kind = monaco.languages.CompletionItemKind.Snippet;
  range: IRange;

  insertText: string;
  documentation?: monaco.IMarkdownString;
  insertTextRules: monaco.languages.CompletionItemInsertTextRule =
    monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  static compareByLabel(a: MonacoSnippetSuggestion, b: MonacoSnippetSuggestion): number {
    return a.label > b.label ? 1 : a.label < b.label ? -1 : 0;
  }

  constructor(readonly snippet: Snippet, range: IRange) {
    this.label = snippet.prefix;
    this.detail = `${snippet.description || snippet.name} (${snippet.source})`;
    this.insertText = snippet.body;
    this.sortText = `z-${snippet.prefix}`;
    this.range = range;
  }

  protected resolved = false;
  resolve(): MonacoSnippetSuggestion {
    if (!this.resolved) {
      const codeSnippet = new SnippetParser().parse(this.snippet.body).toString();
      this.documentation = { value: '```\n' + codeSnippet + '```' };
      this.resolved = true;
    }
    return this;
  }
}
