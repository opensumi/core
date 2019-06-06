import { TextmateRegistry } from './textmate-registry';
import { languageTokens } from './languages/index';
import { Injector, Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { Registry, INITIAL, IRawGrammar, IOnigLib, parseRawGrammar, IRawTheme, StackElement } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'onigasm';
import { TokenizerOption, createTextmateTokenizer, TokenizerOptionDEFAULT } from './textmate-tokenizer';

export function getEncodedLanguageId(languageId: string): number {
  return monaco.languages.getEncodedLanguageId(languageId);
}

export interface LanguageGrammarDefinitionContribution {
  registerTextmateLanguage(registry: TextmateRegistry): void;
}

class OnigasmLib implements IOnigLib {
  createOnigScanner(source: string[]) {
    return new OnigScanner(source);
  }
  createOnigString(source: string) {
    return new OnigString(source);
  }
}

@Injectable()
export class TextmateService {
  @Autowired()
  private textmateRegistry: TextmateRegistry;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private grammarRegistry: Registry;

  initialize(theme?: IRawTheme) {
    for (const GrammarProvider of languageTokens) {
      try {
        const grammarProvider = this.injector.get(GrammarProvider);
        grammarProvider.registerTextmateLanguage(this.textmateRegistry);
      } catch (err) {
        // console.error(err);
      }
    }
    this.initRegistry(theme);
  }

  // TODO 激活逻辑，切换tokensProvider
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

  // TODO theme放到themeService里去处理
  // TODO embed 语言（比如vue、php？）
  private initRegistry(theme?: IRawTheme) {
    this.grammarRegistry = new Registry({
      getOnigLib: this.loadOnigasm,
      theme,
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

    const registered = new Set<string>();
    for (const { id } of monaco.languages.getLanguages()) {
        if (!registered.has(id)) {
            monaco.languages.onLanguage(id, () => this.activateLanguage(id));
            registered.add(id);
        }
    }
  }

  private async loadOnigasm(): Promise<IOnigLib> {
    await loadWASM('http://g.alicdn.com/tb-theia-app/theia-assets/0.0.9/98efdb1150c6b8050818b3ea2552b15b.wasm');
    return new OnigasmLib();
  }
}
