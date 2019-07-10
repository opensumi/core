import { TextmateRegistry } from './textmate-registry';
import { Injector, Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { ContributionProvider, WithEventBus, isNodeIntegrated } from '@ali/ide-core-browser';
import { Registry, IRawGrammar, IOnigLib, parseRawGrammar, IRawTheme } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'onigasm';
import { createTextmateTokenizer, TokenizerOptionDEFAULT } from './textmate-tokenizer';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { ThemeMix } from '@ali/ide-theme/lib/common/theme.service';
import { ThemeChangedEvent } from '@ali/ide-theme/lib/common/event';
import { getNodeRequire } from './monaco-loader';

export function getEncodedLanguageId(languageId: string): number {
  return monaco.languages.getEncodedLanguageId(languageId);
}

export function getLegalThemeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\-]/g, '-');
}

export interface LanguageGrammarDefinitionContribution {
  registerTextmateLanguage(registry: TextmateRegistry): void;
}

export const LanguageGrammarDefinitionContribution = Symbol('LanguageGrammarDefinitionContribution');

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

@Injectable()
export class TextmateService extends WithEventBus {
  @Autowired()
  private textmateRegistry: TextmateRegistry;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(LanguageGrammarDefinitionContribution)
  contributions: ContributionProvider<LanguageGrammarDefinitionContribution>;

  @Autowired()
  workbenchThemeService: WorkbenchThemeService;

  private grammarRegistry: Registry;

  initialize() {
    for (const grammarProvider of this.contributions.getContributions()) {
      try {
        grammarProvider.registerTextmateLanguage(this.textmateRegistry);
      } catch (err) {
        console.error(err);
      }
    }
    this.initRegistry();
    this.listenThemeChange();
  }
  // themeName要求：/^[a-z0-9\-]+$/ 来源vscode源码
  listenThemeChange() {
    this.eventBus.on(ThemeChangedEvent, (e) => {
      const themeData = e.payload.theme.themeData;
      console.log('apply new editor themes: ', themeData);
      this.setTheme(themeData);
    });
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
  private async initRegistry() {
    const currentTheme = await this.workbenchThemeService.getCurrentTheme();
    const themeData = currentTheme.themeData;
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
    this.setTheme(themeData);

    const registered = new Set<string>();
    for (const { id } of monaco.languages.getLanguages()) {
      if (!registered.has(id)) {
        monaco.languages.onLanguage(id, () => this.activateLanguage(id));
        registered.add(id);
      }
    }
  }

  public setTheme(theme: ThemeMix) {
    this.grammarRegistry.setTheme(theme);
    monaco.editor.defineTheme(getLegalThemeName(theme.name), theme);
    monaco.editor.setTheme(getLegalThemeName(theme.name));
  }

  private async getOnigLib(): Promise<IOnigLib> {
    if ((global as any).oniguruma) {
      return new OnigurumaLib((global as any).oniguruma);
    }
    if (isNodeIntegrated()) {
      return new OnigurumaLib(getNodeRequire()('oniguruma'));
    }
    await loadWASM('http://g.alicdn.com/tb-theia-app/theia-assets/0.0.9/98efdb1150c6b8050818b3ea2552b15b.wasm');
    return new OnigasmLib();
  }
}
