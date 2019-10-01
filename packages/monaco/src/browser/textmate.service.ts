import { TextmateRegistry } from './textmate-registry';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WithEventBus, isElectronEnv } from '@ali/ide-core-browser';
import { Registry, IRawGrammar, IOnigLib, parseRawGrammar, IEmbeddedLanguagesMap, ITokenTypeMap, StandardTokenType } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'onigasm';
import { createTextmateTokenizer, TokenizerOptionDEFAULT } from './textmate-tokenizer';
import { getNodeRequire } from './monaco-loader';
import { ThemeChangedEvent } from '@ali/ide-theme/lib/common/event';
import { LanguagesContribution, FoldingRules, IndentationRules, GrammarsContribution, ScopeMap } from '../common';
import * as JSON5 from 'json5';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { Path } from '@ali/ide-core-common/lib/path';
import { ActivationEventService } from '@ali/ide-activation-event';
import { ThemeMix } from '@ali/ide-theme';
import URI from 'vscode-uri';

export function getEncodedLanguageId(languageId: string): number {
  return monaco.languages.getEncodedLanguageId(languageId);
}

export function getLegalThemeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\-]/g, '-');
}

class OnigasmLib implements IOnigLib {
  createOnigScanner(source: string[]) {
    return new OnigScanner(source);
  }
  createOnigString(source: string) {
    return new OnigString(source);
  }
}

class OnigurumaLib implements IOnigLib {

  constructor(private oniguruma) {

  }

  createOnigScanner(source: string[]) {
    return new (this.oniguruma.OnigScanner)(source);
  }
  createOnigString(source: string) {
    return new (this.oniguruma.OnigString)(source);
  }
}

function isStringArr(something: string[] | null): something is string[] {
  if (!Array.isArray(something)) {
    return false;
  }
  for (let i = 0, len = something.length; i < len; i++) {
    if (typeof something[i] !== 'string') {
      return false;
    }
  }
  return true;

}
export type CharacterPair = [string, string];
function isCharacterPair(something: CharacterPair | null): boolean {
  return (
    isStringArr(something)
    && something.length === 2
  );
}

@Injectable()
export class TextmateService extends WithEventBus {
  @Autowired()
  private textmateRegistry: TextmateRegistry;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired()
  activationEventService: ActivationEventService;

  private grammarRegistry: Registry;

  private injections = new Map<string, string[]>();

  private registedLanguage = new Set<string>();

  init() {
    this.initGrammarRegistry();
    this.listenThemeChange();
  }
  // themeName要求：/^[a-z0-9\-]+$/ 来源vscode源码
  listenThemeChange() {
    this.eventBus.on(ThemeChangedEvent, (e) => {
      const themeData = e.payload.theme.themeData;
      this.setTheme(themeData);
    });
  }

  // 字符串转正则
  private createRegex(value: string | undefined): RegExp | undefined {
    if (typeof value === 'string') {
      return new RegExp(value, '');
    }
    return undefined;
  }

  private safeParseJSON(content) {
    let json;
    try {
      json = JSON5.parse(content);
      return json;
    } catch (error) {
      return console.error('语言配置文件解析出错！', content);
    }
  }

  // 将foldingRule里的字符串转为正则
  private convertFolding(folding?: FoldingRules): monaco.languages.FoldingRules | undefined {
    if (!folding) {
      return undefined;
    }
    const result: monaco.languages.FoldingRules = {
      offSide: folding.offSide,
    };

    if (folding.markers) {
      result.markers = {
        end: this.createRegex(folding.markers.end)!,
        start: this.createRegex(folding.markers.start)!,
      };
    }

    return result;

  }

  // 字符串定义转正则
  private convertIndentationRules(rules?: IndentationRules): monaco.languages.IndentationRule | undefined {
    if (!rules) {
      return undefined;
    }
    return {
      decreaseIndentPattern: this.createRegex(rules.decreaseIndentPattern)!,
      increaseIndentPattern: this.createRegex(rules.increaseIndentPattern)!,
      indentNextLinePattern: this.createRegex(rules.indentNextLinePattern),
      unIndentedLinePattern: this.createRegex(rules.unIndentedLinePattern),
    };
  }

  // getEncodedLanguageId是用来干啥的？
  private convertEmbeddedLanguages(languages?: ScopeMap): IEmbeddedLanguagesMap | undefined {
    if (typeof languages === 'undefined' || languages === null) {
      return undefined;
    }

    // tslint:disable-next-line:no-null-keyword
    const result = Object.create(null);
    const scopes = Object.keys(languages);
    const len = scopes.length;
    for (let i = 0; i < len; i++) {
      const scope = scopes[i];
      const langId = languages[scope];
      result[scope] = getEncodedLanguageId(langId);
    }
    return result;
  }

  private convertTokenTypes(tokenTypes?: ScopeMap): ITokenTypeMap | undefined {
    if (typeof tokenTypes === 'undefined' || tokenTypes === null) {
      return undefined;
    }
    // tslint:disable-next-line:no-null-keyword
    const result = Object.create(null);
    const scopes = Object.keys(tokenTypes);
    const len = scopes.length;
    for (let i = 0; i < len; i++) {
      const scope = scopes[i];
      const tokenType = tokenTypes[scope];
      switch (tokenType) {
        case 'string':
          result[scope] = 2; // StandardTokenType.String;
          break;
        case 'other':
          result[scope] = 0; // StandardTokenType.Other;
          break;
        case 'comment':
          result[scope] = 1; // StandardTokenType.Comment;
          break;
      }
    }
    return result;
  }

  private extractValidSurroundingPairs(languageId: string, configuration: any): monaco.languages.IAutoClosingPair[] | undefined {
    if (!configuration) { return; }
    const source = configuration.surroundingPairs;
    if (typeof source === 'undefined') {
      return;
    }
    if (!Array.isArray(source)) {
      console.warn(`[${languageId}: language configuration: expected \`surroundingPairs\` to be an array.`);
      return;
    }

    let result: monaco.languages.IAutoClosingPair[] | undefined;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (Array.isArray(pair)) {
        if (!isCharacterPair(pair as [string, string])) {
          console.warn(`[${languageId}: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
          continue;
        }
        result = result || [];
        result.push({ open: pair[0], close: pair[1] });
      } else {
        if (typeof pair !== 'object') {
          console.warn(`[${languageId}: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
          continue;
        }
        if (typeof pair.open !== 'string') {
          console.warn(`[${languageId}: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`);
          continue;
        }
        if (typeof pair.close !== 'string') {
          console.warn(`[${languageId}: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`);
          continue;
        }
        result = result || [];
        result.push({ open: pair.open, close: pair.close });
      }
    }
    return result;
  }

  async registerLanguage(language: LanguagesContribution, extPath: string) {
    monaco.languages.register({
      id: language.id,
      aliases: language.aliases,
      extensions: language.extensions,
      filenamePatterns: language.filenamePatterns,
      filenames: language.filenames,
      firstLine: language.firstLine,
      mimetypes: language.mimetypes,
    });
    if (language.configuration) {
      const configurationPath = new Path(extPath).join(language.configuration.replace(/^\.\//, '')).toString();
      const { content } = await this.fileServiceClient.resolveContent(URI.file(configurationPath).toString());
      const configuration = this.safeParseJSON(content);
      monaco.languages.setLanguageConfiguration(language.id, {
        wordPattern: this.createRegex(configuration.wordPattern),
        autoClosingPairs: configuration.autoClosingPairs,
        brackets: configuration.brackets,
        comments: configuration.comments,
        folding: this.convertFolding(configuration.folding),
        surroundingPairs: this.extractValidSurroundingPairs(language.id, configuration),
        indentationRules: this.convertIndentationRules(configuration.indentationRules),
      });

      monaco.languages.onLanguage(language.id, () => {
        this.activationEventService.fireEvent('onLanguage', language.id);
      });
    }
  }

  async registerGrammar(grammar: GrammarsContribution, extPath) {
    if (grammar.injectTo) {
      for (const injectScope of grammar.injectTo) {
        let injections = this.injections.get(injectScope);
        if (!injections) {
          injections = [];
          this.injections.set(injectScope, injections);
        }
        injections.push(grammar.scopeName);
      }
    }
    if (grammar.path) {
      const grammarPath = new Path(extPath).join(grammar.path.replace(/^\.\//, '')).toString();
      const { content } = await this.fileServiceClient.resolveContent(URI.file(grammarPath).toString());
      if (/\.json$/.test(grammar.path)) {
        grammar.grammar = this.safeParseJSON(content);
        grammar.format = 'json';
      } else {
        grammar.grammar = content;
        grammar.format = 'plist';
      }
    }
    this.textmateRegistry.registerTextmateGrammarScope(grammar.scopeName, {
      async getGrammarDefinition() {
        return {
          format: grammar.format,
          content: grammar.grammar || '',
        };
      },
      getInjections: (scopeName: string) => this.injections.get(scopeName)!,
    });
    if (grammar.language) {
      this.textmateRegistry.mapLanguageIdToTextmateGrammar(grammar.language, grammar.scopeName);
      this.textmateRegistry.registerGrammarConfiguration(grammar.language, {
        embeddedLanguages: this.convertEmbeddedLanguages(grammar.embeddedLanguages),
        tokenTypes: this.convertTokenTypes(grammar.tokenTypes),
      });
      if (this.registedLanguage.has(grammar.language)) {
        console.warn(`${grammar.language}语言已被注册过`);
      }
      monaco.languages.onLanguage(grammar.language, () => this.activateLanguage(grammar.language!));
    }
  }

  async activateLanguage(languageId: string) {
    const scopeName = this.textmateRegistry.getScope(languageId);
    if (!scopeName) {
      return;
    }
    const provider = this.textmateRegistry.getProvider(scopeName);
    if (!provider) {
      return;
    }

    const configuration = this.textmateRegistry.getGrammarConfiguration(languageId);
    const initialLanguage = getEncodedLanguageId(languageId);

    try {
      const grammar = await this.grammarRegistry.loadGrammarWithConfiguration(
        scopeName, initialLanguage, configuration);
      const options = configuration.tokenizerOption ? configuration.tokenizerOption : TokenizerOptionDEFAULT;
      monaco.languages.setTokensProvider(languageId, createTextmateTokenizer(grammar, options));
    } catch (error) {
      // console.warn('No grammar for this language id', languageId, error);
    }
  }

  // TODO embed 语言（比如vue、php？）
  private async initGrammarRegistry() {
    this.grammarRegistry = new Registry({
      getOnigLib: this.getOnigLib,
      loadGrammar: async (scopeName: string) => {
        const provider = this.textmateRegistry.getProvider(scopeName);
        if (provider) {
          const definition = await provider.getGrammarDefinition();
          let rawGrammar: IRawGrammar;
          if (typeof definition.content === 'string') {
            rawGrammar = parseRawGrammar(
              definition.content, definition.format === 'json' ? 'grammar.json' : 'grammar.plist');
          } else {
            rawGrammar = definition.content as IRawGrammar;
          }
          return rawGrammar;
        }
        return undefined;
      },
      getInjections: (scopeName: string) => {
        const provider = this.textmateRegistry.getProvider(scopeName);
        if (provider && provider.getInjections) {
          return provider.getInjections(scopeName);
        }
        return [];
      },
    });
  }

  public setTheme(themeData: ThemeMix) {
    const theme = themeData;
    this.grammarRegistry.setTheme(theme);
    monaco.editor.defineTheme(getLegalThemeName(theme.name), theme);
    monaco.editor.setTheme(getLegalThemeName(theme.name));
  }

  private async getOnigLib(): Promise<IOnigLib> {
    if ((global as any).oniguruma) {
      return new OnigurumaLib((global as any).oniguruma);
    }
    if (isElectronEnv()) {
      return new OnigurumaLib(getNodeRequire()('oniguruma'));
    }
    await loadWASM('https://g.alicdn.com/tb-theia-app/theia-assets/0.0.9/98efdb1150c6b8050818b3ea2552b15b.wasm');
    return new OnigasmLib();
  }
}
