import { OnigScanner, loadWASM, OnigString } from 'vscode-oniguruma';
import {
  Registry,
  IRawGrammar,
  IOnigLib,
  parseRawGrammar,
  IEmbeddedLanguagesMap,
  ITokenTypeMap,
  INITIAL,
} from 'vscode-textmate';

import { Injectable, Autowired } from '@opensumi/di';
import {
  WithEventBus,
  parseWithComments,
  PreferenceService,
  ILogger,
  ExtensionActivateEvent,
  getDebugLogger,
  MonacoService,
  electronEnv,
  AppConfig,
} from '@opensumi/ide-core-browser';
import { URI, Disposable, isObject } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import {
  GrammarsContribution,
  ITextmateTokenizerService,
  ScopeMap,
} from '@opensumi/ide-monaco/lib/browser/contrib/tokenizer';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import {
  EnterAction,
  FoldingRules,
  IAutoClosingPair,
  IAutoClosingPairConditional,
  IndentationRule,
  LanguageConfiguration,
  OnEnterRule,
} from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import {
  CommentRule,
  IIndentationRule,
  IndentAction,
  IndentationRuleDto,
  IRegExp,
  LanguageConfigurationDto,
  LanguagesContribution,
} from '@opensumi/ide-monaco/lib/common';
import { IThemeData } from '@opensumi/ide-theme';
import { ThemeChangedEvent } from '@opensumi/ide-theme/lib/common/event';
import type { ILanguageExtensionPoint } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { ModesRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/modesRegistry';

import { IEditorDocumentModelService } from '../../doc-model/types';

import { TextmateRegistry } from './textmate-registry';
import { createTextmateTokenizer, TokenizerOption } from './textmate-tokenizer';

let wasmLoaded = false;

export function getEncodedLanguageId(languageId: string): number {
  return monaco.languages.getEncodedLanguageId(languageId);
}

export function getLegalThemeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

class OnigasmLib implements IOnigLib {
  createOnigScanner(source: string[]) {
    return new OnigScanner(source);
  }
  createOnigString(source: string) {
    return new OnigString(source);
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
  return isStringArr(something) && something.length === 2;
}

@Injectable()
export class TextmateService extends WithEventBus implements ITextmateTokenizerService {
  @Autowired()
  private textmateRegistry: TextmateRegistry;

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired()
  private readonly monacoService: MonacoService;

  @Autowired(IEditorDocumentModelService)
  editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  public grammarRegistry: Registry;

  private registeredGrammarDisposableCollection = new Map<string, Disposable>();

  private injections = new Map<string, string[]>();

  private activatedLanguage = new Set<string>();

  public initialized = false;

  private dynamicLanguages: ILanguageExtensionPoint[] = [];

  /**
   * start contribution 做初始化
   */
  init() {
    this.initGrammarRegistry();
    this.listenThemeChange();
    this.listenPreferenceChange();
  }

  // themeName要求：/^[a-z0-9\-]+$/ 来源vscode源码
  listenThemeChange() {
    this.eventBus.on(ThemeChangedEvent, (e) => {
      const themeData = e.payload.theme.themeData;
      this.setTheme(themeData);
    });
  }

  async registerLanguage(language: LanguagesContribution, extPath: URI) {
    return this.registerLanguages([language], extPath);
  }

  private reviveLanguageConfiguration(id: string, configuration: LanguageConfigurationDto): LanguageConfiguration {
    return {
      wordPattern: this.createRegex(configuration.wordPattern),
      autoClosingPairs: this.extractValidAutoClosingPairs(id, configuration),
      brackets: this.extractValidBrackets(id, configuration),
      comments: this.extractValidCommentRule(id, configuration),
      folding: this.convertFolding(configuration.folding),
      surroundingPairs: this.extractValidSurroundingPairs(id, configuration),
      indentationRules: this.convertIndentationRules(configuration.indentationRules),
      autoCloseBefore: configuration.autoCloseBefore,
      colorizedBracketPairs: this.extractValidColorizedBracketPairs(id, configuration),
      onEnterRules: this.extractValidOnEnterRules(id, configuration),
    };
  }

  async registerLanguages(languages: LanguagesContribution[], extPath: URI) {
    this.dynamicLanguages.push(
      ...languages.map((language) => ({
        id: language.id,
        aliases: language.aliases,
        extensions: language.extensions,
        filenamePatterns: language.filenamePatterns,
        filenames: language.filenames,
        firstLine: language.firstLine,
        mimetypes: language.mimetypes,
      })),
    );

    for (const language of this.dynamicLanguages) {
      ModesRegistry.registerLanguage(language);
    }

    const languageIds: string[] = [];

    await Promise.all(
      languages.map(async (language) => {
        this.addDispose(
          monaco.languages.onLanguage(language.id, () => {
            this.activateLanguage(language.id);
          }),
        );

        let configuration: LanguageConfiguration | undefined;
        if (typeof language.resolvedConfiguration === 'object') {
          const config = await language.resolvedConfiguration;
          configuration = this.reviveLanguageConfiguration(language.id, config);
        } else if (language.configuration) {
          // remove `./` prefix
          const langPath = language.configuration.replace(/^\.\//, '');
          // http 的不作支持
          const configurationPath = extPath.resolve(langPath);
          const ret = await this.fileServiceClient.resolveContent(configurationPath.toString());
          const content = ret.content;
          if (content) {
            const jsonContent = this.safeParseJSON<LanguageConfigurationDto>(content);
            if (jsonContent) {
              configuration = this.reviveLanguageConfiguration(language.id, jsonContent);
            }
          }
        }

        if (configuration) {
          monaco.languages.setLanguageConfiguration(language.id, configuration);
        }

        languageIds.push(language.id);
      }),
    );

    if (this.initialized) {
      const uris = this.editorDocumentModelService.getAllModels().map((m) => m.uri);
      for (const uri of uris) {
        const model = this.editorDocumentModelService.getModelReference(URI.parse(uri.codeUri.toString()));
        if (model && model.instance) {
          const langId = model.instance.getMonacoModel().getLanguageId();
          if (languageIds.includes(langId)) {
            this.activateLanguage(langId);
          }
        }
        model?.dispose();
      }
    }
  }

  async registerGrammar(grammar: GrammarsContribution, extPath: URI) {
    if (grammar.path) {
      const grammarPath = grammar.path.replace(/^\.\//, '');
      // get content in `initGrammarRegistry`
      grammar.location = extPath.resolve(grammarPath);
    }

    this.doRegisterGrammar(grammar);
  }

  unregisterGrammar(grammar: GrammarsContribution) {
    const toDispose = this.registeredGrammarDisposableCollection.get(grammar.scopeName);

    if (toDispose) {
      toDispose.dispose();
    }
  }

  doRegisterGrammar(grammar: GrammarsContribution) {
    const toDispose = new Disposable();

    if (grammar.injectTo) {
      for (const injectScope of grammar.injectTo) {
        let injections = this.injections.get(injectScope);
        if (!injections) {
          injections = [];

          toDispose.addDispose(
            Disposable.create(() => {
              this.injections.delete(injectScope);
            }),
          );

          this.injections.set(injectScope, injections);
        }
        injections.push(grammar.scopeName);
      }
    }

    toDispose.addDispose(
      Disposable.create(
        this.textmateRegistry.registerTextmateGrammarScope(grammar.scopeName, {
          async getGrammarDefinition() {
            return {
              format: /\.json$/.test(grammar.path) ? 'json' : 'plist',
              location: grammar.location!,
              content: await grammar.resolvedConfiguration,
            };
          },
          getInjections: (scopeName: string) => {
            const scopeParts = scopeName.split('.');
            let injections: string[] = [];
            for (let i = 1; i <= scopeParts.length; i++) {
              const subScopeName = scopeParts.slice(0, i).join('.');
              injections = [...injections, ...(this.injections.get(subScopeName) || [])];
            }
            return injections;
          },
        }),
      ),
    );

    if (grammar.language) {
      toDispose.addDispose(
        Disposable.create(this.textmateRegistry.mapLanguageIdToTextmateGrammar(grammar.language, grammar.scopeName)),
      );

      toDispose.addDispose(
        Disposable.create(
          this.textmateRegistry.registerGrammarConfiguration(grammar.language, () => ({
            embeddedLanguages: this.convertEmbeddedLanguages(grammar.embeddedLanguages),
            tokenTypes: this.convertTokenTypes(grammar.tokenTypes),
          })),
        ),
      );
    }

    this.registeredGrammarDisposableCollection.set(grammar.scopeName, toDispose);
  }

  async activateLanguage(languageId: string) {
    // 允许后来的插件上车
    this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onLanguage', data: languageId }));
    if (this.activatedLanguage.has(languageId)) {
      return;
    }
    this.activatedLanguage.add(languageId);
    this.setTokensProviderByLanguageId(languageId);
  }

  private async setTokensProviderByLanguageId(languageId: string) {
    const scopeName = this.textmateRegistry.getScope(languageId);
    if (!scopeName) {
      return;
    }
    const provider = this.textmateRegistry.getProvider(scopeName);
    if (!provider) {
      return;
    }
    const tokenizerOption: TokenizerOption = {
      lineLimit: this.preferenceService.get('editor.maxTokenizationLineLength') || 10000,
    };
    const configuration = this.textmateRegistry.getGrammarConfiguration(languageId)();
    const initialLanguage = getEncodedLanguageId(languageId);

    try {
      const grammar = await this.grammarRegistry.loadGrammarWithConfiguration(
        scopeName,
        initialLanguage,
        configuration,
      );
      const options = configuration.tokenizerOption ? configuration.tokenizerOption : tokenizerOption;
      // 要保证grammar把所有的languageID关联的语法都注册好了
      if (grammar) {
        monaco.languages.setTokensProvider(languageId, createTextmateTokenizer(grammar, options));
      }
    } catch (error) {
      this.logger.warn('No grammar for this language id', languageId, error);
    }
  }

  public setTheme(theme: IThemeData) {
    this.generateEncodedTokenColors(theme);
    monaco.editor.defineTheme(getLegalThemeName(theme.name), theme);
    monaco.editor.setTheme(getLegalThemeName(theme.name));
  }

  private generateEncodedTokenColors(themeData: IThemeData) {
    // load时会转换customTokenColors
    this.grammarRegistry.setTheme(themeData);
    themeData.encodedTokensColors = this.grammarRegistry.getColorMap();
    // index 0 has to be set to null as it is 'undefined' by default, but monaco code expects it to be null
    themeData.encodedTokensColors[0] = null!;
  }

  // 字符串转正则
  private createRegex(value?: IRegExp): RegExp | undefined {
    if (typeof value === 'string') {
      return new RegExp(value, '');
    }

    if (isObject(value)) {
      if (typeof value.pattern !== 'string') {
        return undefined;
      }

      if (typeof value.flags !== 'undefined' && typeof value.flags !== 'string') {
        return undefined;
      }

      try {
        return new RegExp(value.pattern, value.flags);
      } catch (err) {
        return undefined;
      }
    }
    return undefined;
  }

  private safeParseJSON<T = any>(content): T | undefined {
    let json;
    try {
      json = parseWithComments(content);
      return json;
    } catch (error) {
      this.logger.error('语言配置文件解析出错！', content);
      return;
    }
  }

  // 将foldingRule里的字符串转为正则
  private convertFolding(folding?: IndentationRuleDto): FoldingRules | undefined {
    if (!folding) {
      return undefined;
    }
    const result: FoldingRules = {
      offSide: folding.offSide,
    };

    if (folding.markers) {
      result.markers = {
        end: folding.markers.end!,
        start: folding.markers.start!,
      };
    }

    return result;
  }

  // 字符串定义转正则
  private convertIndentationRules(rules?: IIndentationRule): IndentationRule | undefined {
    if (!rules) {
      return undefined;
    }
    const result: IndentationRule = {
      decreaseIndentPattern: this.createRegex(rules.decreaseIndentPattern)!,
      increaseIndentPattern: this.createRegex(rules.increaseIndentPattern)!,
    };
    if (rules.indentNextLinePattern) {
      result.indentNextLinePattern = this.createRegex(rules.indentNextLinePattern);
    }
    if (rules.unIndentedLinePattern) {
      result.unIndentedLinePattern = this.createRegex(rules.unIndentedLinePattern);
    }
    return result;
  }

  private convertEmbeddedLanguages(languages?: ScopeMap): IEmbeddedLanguagesMap | undefined {
    if (typeof languages === 'undefined' || languages === null) {
      return undefined;
    }

    const result = Object.create(null);
    const scopes = Object.keys(languages);
    const len = scopes.length;
    for (let i = 0; i < len; i++) {
      const scope = scopes[i];
      const langId = languages[scope];
      result[scope] = getEncodedLanguageId(langId);
      // TODO 后置到 tokenize 使用到对应的 scope 时激活（vscode逻辑），现在先激活一个 language 时激活所有 embed language
      if (!this.activatedLanguage.has(langId)) {
        this.activateLanguage(langId);
      }
    }
    return result;
  }

  private convertTokenTypes(tokenTypes?: ScopeMap): ITokenTypeMap | undefined {
    if (typeof tokenTypes === 'undefined' || tokenTypes === null) {
      return undefined;
    }
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

  private extractValidSurroundingPairs(
    languageId: string,
    configuration: LanguageConfigurationDto,
  ): IAutoClosingPair[] | undefined {
    if (!configuration) {
      return;
    }
    const source = configuration.surroundingPairs;
    if (typeof source === 'undefined') {
      return;
    }
    if (!Array.isArray(source)) {
      this.logger.warn(`[${languageId}: language configuration: expected \`surroundingPairs\` to be an array.`);
      return;
    }

    let result: IAutoClosingPair[] | undefined;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (Array.isArray(pair)) {
        if (!isCharacterPair(pair as unknown as [string, string])) {
          this.logger.warn(
            `[${languageId}: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`,
          );
          continue;
        }
        result = result || [];
        result.push({ open: pair[0], close: pair[1] });
      } else {
        if (typeof pair !== 'object') {
          this.logger.warn(
            `[${languageId}: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`,
          );
          continue;
        }
        if (typeof pair.open !== 'string') {
          this.logger.warn(
            `[${languageId}: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`,
          );
          continue;
        }
        if (typeof pair.close !== 'string') {
          this.logger.warn(
            `[${languageId}: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`,
          );
          continue;
        }
        result = result || [];
        result.push({ open: pair.open, close: pair.close });
      }
    }
    return result;
  }

  private extractValidColorizedBracketPairs(
    languageId: string,
    configuration: LanguageConfigurationDto,
  ): CharacterPair[] | undefined {
    const source = configuration.colorizedBracketPairs;
    if (typeof source === 'undefined') {
      return undefined;
    }
    if (!Array.isArray(source)) {
      this.logger.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs\` to be an array.`);
      return undefined;
    }

    const result: CharacterPair[] = [];
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (!isCharacterPair(pair)) {
        this.logger.warn(
          `[${languageId}]: language configuration: expected \`colorizedBracketPairs[${i}]\` to be an array of two strings.`,
        );
        continue;
      }
      result.push([pair[0], pair[1]]);
    }
    return result;
  }

  private extractValidOnEnterRules(
    languageId: string,
    configuration: LanguageConfigurationDto,
  ): OnEnterRule[] | undefined {
    const source = configuration.onEnterRules;
    if (typeof source === 'undefined') {
      return undefined;
    }
    if (!Array.isArray(source)) {
      this.logger.warn(`[${languageId}]: language configuration: expected \`onEnterRules\` to be an array.`);
      return undefined;
    }

    let result: OnEnterRule[] | undefined;
    for (let i = 0, len = source.length; i < len; i++) {
      const onEnterRule = source[i];
      if (!isObject(onEnterRule)) {
        this.logger.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}]\` to be an object.`);
        continue;
      }
      if (!isObject(onEnterRule.action)) {
        this.logger.warn(
          `[${languageId}]: language configuration: expected \`onEnterRules[${i}].action\` to be an object.`,
        );
        continue;
      }
      let indentAction: IndentAction;
      if (onEnterRule.action.indent === 'none') {
        indentAction = IndentAction.None;
      } else if (onEnterRule.action.indent === 'indent') {
        indentAction = IndentAction.Indent;
      } else if (onEnterRule.action.indent === 'indentOutdent') {
        indentAction = IndentAction.IndentOutdent;
      } else if (onEnterRule.action.indent === 'outdent') {
        indentAction = IndentAction.Outdent;
      } else {
        this.logger.warn(
          `[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.indent\` to be 'none', 'indent', 'indentOutdent' or 'outdent'.`,
        );
        continue;
      }
      const action: EnterAction = { indentAction };
      if (onEnterRule.action.appendText) {
        if (typeof onEnterRule.action.appendText === 'string') {
          action.appendText = onEnterRule.action.appendText;
        } else {
          this.logger.warn(
            `[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.appendText\` to be undefined or a string.`,
          );
        }
      }
      if (onEnterRule.action.removeText) {
        if (typeof onEnterRule.action.removeText === 'number') {
          action.removeText = onEnterRule.action.removeText;
        } else {
          this.logger.warn(
            `[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.removeText\` to be undefined or a number.`,
          );
        }
      }
      const beforeText = this.createRegex(onEnterRule.beforeText);
      if (!beforeText) {
        continue;
      }
      const resultingOnEnterRule: OnEnterRule = { beforeText, action };
      if (onEnterRule.afterText) {
        const afterText = this.createRegex(onEnterRule.afterText);
        if (afterText) {
          resultingOnEnterRule.afterText = afterText;
        }
      }
      if (onEnterRule.previousLineText) {
        const previousLineText = this.createRegex(onEnterRule.previousLineText);
        if (previousLineText) {
          resultingOnEnterRule.previousLineText = previousLineText;
        }
      }
      result = result || [];
      result.push(resultingOnEnterRule);
    }

    return result;
  }

  private extractValidBrackets(
    languageId: string,
    configuration: LanguageConfigurationDto,
  ): CharacterPair[] | undefined {
    const source = configuration.brackets;
    if (typeof source === 'undefined') {
      return undefined;
    }
    if (!Array.isArray(source)) {
      this.logger.warn(`[${languageId}]: language configuration: expected \`brackets\` to be an array.`);
      return undefined;
    }

    let result: CharacterPair[] | undefined;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (!isCharacterPair(pair)) {
        this.logger.warn(
          `[${languageId}]: language configuration: expected \`brackets[${i}]\` to be an array of two strings.`,
        );
        continue;
      }

      result = result || [];
      result.push(pair);
    }
    return result;
  }

  private extractValidAutoClosingPairs(
    languageId: string,
    configuration: LanguageConfigurationDto,
  ): IAutoClosingPairConditional[] | undefined {
    const source = configuration.autoClosingPairs;
    if (typeof source === 'undefined') {
      return undefined;
    }
    if (!Array.isArray(source)) {
      this.logger.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs\` to be an array.`);
      return undefined;
    }

    let result: IAutoClosingPairConditional[] | undefined;
    for (let i = 0, len = source.length; i < len; i++) {
      const pair = source[i];
      if (Array.isArray(pair)) {
        if (!isCharacterPair(pair as unknown as [string, string])) {
          this.logger.warn(
            `[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`,
          );
          continue;
        }
        result = result || [];
        result.push({ open: pair[0], close: pair[1] });
      } else {
        if (typeof pair !== 'object') {
          this.logger.warn(
            `[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`,
          );
          continue;
        }
        if (typeof pair.open !== 'string') {
          this.logger.warn(
            `[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].open\` to be a string.`,
          );
          continue;
        }
        if (typeof pair.close !== 'string') {
          this.logger.warn(
            `[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].close\` to be a string.`,
          );
          continue;
        }
        if (typeof pair.notIn !== 'undefined') {
          if (!isStringArr(pair.notIn)) {
            this.logger.warn(
              `[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].notIn\` to be a string array.`,
            );
            continue;
          }
        }
        result = result || [];
        result.push({ open: pair.open, close: pair.close, notIn: pair.notIn });
      }
    }
    return result;
  }

  private extractValidCommentRule(
    languageId: string,
    configuration: LanguageConfigurationDto,
  ): CommentRule | undefined {
    const source = configuration.comments;
    if (typeof source === 'undefined') {
      return undefined;
    }
    if (typeof source !== 'object') {
      this.logger.warn(`[${languageId}]: language configuration: expected \`comments\` to be an object.`);
      return undefined;
    }

    let result: CommentRule | undefined;
    if (typeof source.lineComment !== 'undefined') {
      if (typeof source.lineComment !== 'string') {
        this.logger.warn(`[${languageId}]: language configuration: expected \`comments.lineComment\` to be a string.`);
      } else {
        result = result || {};
        result.lineComment = source.lineComment;
      }
    }
    if (typeof source.blockComment !== 'undefined') {
      if (!isCharacterPair(source.blockComment)) {
        this.logger.warn(
          `[${languageId}]: language configuration: expected \`comments.blockComment\` to be an array of two strings.`,
        );
      } else {
        result = result || {};
        result.blockComment = source.blockComment;
      }
    }
    return result;
  }

  private async initGrammarRegistry() {
    this.grammarRegistry = new Registry({
      onigLib: this.getOnigLib(),
      loadGrammar: async (scopeName: string) => {
        const provider = this.textmateRegistry.getProvider(scopeName);
        if (provider) {
          const definition = await provider.getGrammarDefinition();
          if (!definition.content) {
            const ret = await this.fileServiceClient.resolveContent(definition.location.toString());
            const content = ret.content;
            definition.content = definition.format === 'json' ? this.safeParseJSON(content) : content;
          }

          let rawGrammar: IRawGrammar;
          if (typeof definition.content === 'string') {
            rawGrammar = parseRawGrammar(
              definition.content,
              definition.format === 'json' ? 'grammar.json' : 'grammar.plist',
            );
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

    this.activateLanguages();
  }

  private activateLanguages() {
    for (const { id: languageId } of monaco.languages.getLanguages()) {
      if (this.editorDocumentModelService.hasLanguage(languageId)) {
        this.activateLanguage(languageId);
      }
    }
  }

  private async getOnigLib(): Promise<IOnigLib> {
    // loadWasm 二次加载会报错 https://github.com/microsoft/vscode-oniguruma/blob/main/src/index.ts#L378
    if (wasmLoaded) {
      return new OnigasmLib();
    }

    let wasmUri: string;
    if (this.appConfig.isElectronRenderer && electronEnv.onigWasmPath) {
      wasmUri = URI.file(electronEnv.onigWasmPath).codeUri.toString();
    } else if (this.appConfig.isElectronRenderer && electronEnv.onigWasmUri) {
      wasmUri = electronEnv.onigWasmUri;
    } else {
      wasmUri =
        this.appConfig.onigWasmUri ||
        this.appConfig.onigWasmPath ||
        'https://g.alicdn.com/kaitian/vscode-oniguruma-wasm/1.5.1/onig.wasm';
    }

    const response = await fetch(wasmUri);
    const bytes = await response.arrayBuffer();
    await loadWASM(bytes);
    wasmLoaded = true;
    return new OnigasmLib();
  }

  private listenPreferenceChange() {
    this.preferenceService.onPreferenceChanged((e) => {
      if (e.preferenceName === 'editor.maxTokenizationLineLength') {
        for (const languageId of this.activatedLanguage) {
          this.setTokensProviderByLanguageId(languageId);
        }
      }
    });
  }

  async testTokenize(line: string, languageId: string) {
    const scopeName = this.textmateRegistry.getScope(languageId);
    if (!scopeName) {
      return;
    }
    const configuration = this.textmateRegistry.getGrammarConfiguration(languageId)();
    const initialLanguage = getEncodedLanguageId(languageId);
    const grammar = (await this.grammarRegistry.loadGrammarWithConfiguration(
      scopeName,
      initialLanguage,
      configuration,
    ))!;
    let ruleStack = INITIAL;
    const lineTokens = grammar.tokenizeLine(line, ruleStack);
    const debugLogger = getDebugLogger('tokenize');
    debugLogger.log(`\nTokenizing line: ${line}`);
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let j = 0; j < lineTokens.tokens.length; j++) {
      const token = lineTokens.tokens[j];
      debugLogger.log(
        ` - token from ${token.startIndex} to ${token.endIndex} ` +
          `(${line.substring(token.startIndex, token.endIndex)}) ` +
          `with scopes ${token.scopes.join(', ')}`,
      );
    }
    ruleStack = lineTokens.ruleStack;
  }
}
