import {Registry, INITIAL, IOnigLib, parseRawGrammar, IRawTheme, StackElement} from 'vscode-textmate';
import {loadWASM, OnigScanner, OnigString} from 'onigasm';
// @ts-ignore
import ts_json from './languages/ts';
// @ts-ignore
import js_json from './languages/js';
// @ts-ignore
import {regExpGrammar} from './languages/js_reg';
import TokenizerState from './tokenizer-state';
import { Injectable } from '@ali/common-di';

const MAX_TOKENIZE_LENGTH = 400;

class OnigasmLib implements IOnigLib {
  createOnigScanner(source: string[]) {
    return new OnigScanner(source);
  }
  createOnigString(source: string) {
    return new OnigString(source);
  }
}

@Injectable()
export class LanguageRegistry {

  grammars: Map<string, string>;
  registry!: Registry;

  constructor() {
    this.grammars = new Map();
  }

  async initialize(theme?: IRawTheme) {
    this.registerLanguage();
    this.initRegistry(theme);
    await this.bindTokenProvider('javascript', this.grammars.get('javascript') as string);
    await this.bindTokenProvider('typescript', this.grammars.get('typescript') as string);
  }

  /*tslint:disable object-literal-key-quotes */
  private registerLanguage() {
    this.grammars.set('javascript', 'source.js');
    this.grammars.set('typescript', 'source.ts');
    monaco.languages.register({
      id: 'javascript',
      extensions: ['.js'],
      aliases: ['js', 'javascript'],
      mimetypes: ['text/javascript'],
    });
    monaco.languages.register({
      id: 'typescript',
      extensions: ['.ts'],
      aliases: ['ts', 'typescript', 'TypeScript'],
      mimetypes: ['text/typescript'],
    });
    // NOTE 本地自动补全配置
    monaco.languages.setLanguageConfiguration('typescript', {
      'comments': {
        'lineComment': '//',
        'blockComment': ['/*', '*/'],
      },
      'brackets': [
          ['{', '}'],
          ['[', ']'],
          ['(', ')'],
      ],
      'autoClosingPairs': [
          { 'open': '{', 'close': '}' },
          { 'open': '[', 'close': ']' },
          { 'open': '(', 'close': ')' },
          { 'open': "'", 'close': "'", 'notIn': ['string', 'comment'] },
          { 'open': '"', 'close': '"', 'notIn': ['string'] },
          { 'open': '`', 'close': '`', 'notIn': ['string', 'comment'] },
          { 'open': '/**', 'close': ' */', 'notIn': ['string'] },
      ],
      'surroundingPairs': [
          { 'open': '{', 'close': '}' },
          { 'open': '[', 'close': ']' },
          { 'open': '(', 'close': ')' },
          { 'open': "'", 'close': "'" },
          { 'open': '"', 'close': '"' },
          { 'open': '`', 'close': '`' },
      ],
      'folding': {
        'markers': {
          'start': new RegExp('^\\s*//\\s*#?region\\b'),
          'end': new RegExp('^\\s*//\\s*#?endregion\\b'),
        },
      },
    });

  }

  /**
   * 为指定语言绑定自定义的textmate分词库
   */
  private async bindTokenProvider(languageId: string, scopeName: string) {
    // NOTE loadGrammarWithConfiguration 支持带参数
    const targetGrammar = await this.registry.loadGrammar(scopeName);
    monaco.languages.setTokensProvider(languageId, {
      getInitialState: () => new TokenizerState(INITIAL),
      tokenizeEncoded: (line, state: TokenizerState) => {
        if (line.length > MAX_TOKENIZE_LENGTH) {
          return {
            tokens: new Uint32Array(),
            endState: new TokenizerState(null),
          };
        }
        // tokenizeLine2会携带颜色信息，也可以使用普通的tokenizeLine
        const tokenizerResult = targetGrammar.tokenizeLine2(line, state.ruleStack as StackElement);
        const ret = {
          tokens: tokenizerResult.tokens,
          endState: new TokenizerState(tokenizerResult.ruleStack),
        };
        return ret;
      },
    });
  }

  private async loadOnigasm(): Promise<IOnigLib> {
    await loadWASM('http://g.alicdn.com/tb-theia-app/theia-assets/0.0.9/98efdb1150c6b8050818b3ea2552b15b.wasm');
    return new OnigasmLib();
  }

  private initRegistry(theme?: IRawTheme) {
    this.registry = new Registry({
      getOnigLib: this.loadOnigasm,
      theme,
      loadGrammar: async (scopeName) => {
        let grammarContent = JSON.stringify(js_json);
        if (scopeName === this.grammars.get('typescript')) {
          grammarContent = JSON.stringify(ts_json);
        } else if (scopeName === 'source.js.regexp') {
          grammarContent = regExpGrammar;
        }
        const rawGrammar = parseRawGrammar(grammarContent, 'grammar.json');
        return rawGrammar;
      },
    });
  }

}
