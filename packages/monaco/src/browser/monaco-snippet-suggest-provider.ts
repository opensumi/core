import * as jsoncparser from 'jsonc-parser';
import { Injectable, Autowired } from '@ali/common-di';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import URI from 'vscode-uri';
import { IRange, Uri } from '@ali/ide-core-common';
import { Path } from '@ali/ide-core-common/lib/path';

@Injectable()
export class MonacoSnippetSuggestProvider implements monaco.languages.CompletionItemProvider {

    @Autowired(IFileServiceClient)
    protected readonly filesystem: IFileServiceClient;

    protected readonly snippets = new Map<string, monaco.languages.CompletionItem[]>();
    protected readonly pendingSnippets = new Map<string, Promise<void>[]>();

    async provideCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position, context: monaco.languages.CompletionContext, token: monaco.CancellationToken): Promise<monaco.languages.CompletionList> {
        const languageId = model.getModeId(); // TODO: look up a language id at the position
        await this.loadSnippets(languageId);
        const suggestions = this.snippets.get(languageId) || [];
        return { suggestions };
    }

    resolveCompletionItem(_: monaco.editor.ITextModel, __: monaco.Position, item: monaco.languages.CompletionItem, token: monaco.CancellationToken) {
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

    fromPath(path: string, options: SnippetLoadOptions): Promise<void> {
        const snippetPath = new Path(options.extPath).join(path.replace(/^\.\//, '')).toString();
        const pending = this.loadURI(Uri.file(snippetPath), options);
        const { language } = options;
        const scopes = Array.isArray(language) ? language : !!language ? [language] : ['*'];
        for (const scope of scopes) {
            const pendingSnippets = this.pendingSnippets.get(scope) || [];
            pendingSnippets.push(pending);
            this.pendingSnippets.set(scope, pendingSnippets);
        }
        return pending;
    }
    /**
     * should NOT throw to prevent load erros on suggest
     */
    protected async loadURI(uri: string | URI, options: SnippetLoadOptions): Promise<void> {
        try {
            const { content } = await this.filesystem.resolveContent(uri.toString(), { encoding: 'utf-8' });
            const snippets = content && jsoncparser.parse(content, undefined, { disallowComments: false });
            this.fromJSON(snippets, options);
        } catch (e) {
            console.error(e);
        }
    }

    fromJSON(snippets: JsonSerializedSnippets | undefined, { language, source }: SnippetLoadOptions): void {
        this.parseSnippets(snippets, (name, snippet) => {
            // tslint:disable-next-line:prefer-const
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
            this.push({
                scopes,
                name,
                prefix,
                description,
                body,
                source,
            });
        });
    }
    protected parseSnippets(snippets: JsonSerializedSnippets | undefined, accept: (name: string, snippet: JsonSerializedSnippet) => void): void {
        if (typeof snippets === 'object') {
            // tslint:disable-next-line:forin
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

    push(...snippets: Snippet[]): void {
        for (const snippet of snippets) {
            for (const scope of snippet.scopes) {
                const languageSnippets = this.snippets.get(scope) || [];
                languageSnippets.push(new MonacoSnippetSuggestion(snippet));
                this.snippets.set(scope, languageSnippets);
            }
        }
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
    // tslint:disable-next-line:ban-types
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

    readonly label: string;
    readonly detail: string;
    readonly sortText: string;
    readonly noAutoAccept = true;
    readonly type: 'snippet' = 'snippet';
    readonly snippetType: 'textmate' = 'textmate';
    readonly kind = monaco.languages.CompletionItemKind.Snippet;
    // 不传Range默认应该能拿到 getWordRangeAtPosition
    // @ts-ignore
    range = null as IRange;

    insertText: string;
    documentation?: monaco.IMarkdownString;
    insertTextRules: monaco.languages.CompletionItemInsertTextRule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

    constructor(protected readonly snippet: Snippet) {
        this.label = snippet.prefix;
        this.detail = `${snippet.description || snippet.name} (${snippet.source})`;
        this.insertText = snippet.body;
        this.sortText = `z-${snippet.prefix}`;
    }

    protected resolved = false;
    resolve(): MonacoSnippetSuggestion {
        if (!this.resolved) {
            const codeSnippet = new monaco.snippetParser.SnippetParser().parse(this.snippet.body).toString();
            this.documentation = { value: '```\n' + codeSnippet + '```' };
            this.resolved = true;
        }
        return this;
    }

}
