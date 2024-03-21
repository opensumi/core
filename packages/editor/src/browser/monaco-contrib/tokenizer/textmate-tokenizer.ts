import { IGrammar, INITIAL, StackElement } from 'vscode-textmate';

import { Disposable, Emitter, Event } from '@opensumi/ide-core-common/lib/utils';
import * as monaco from '@opensumi/ide-monaco';
import {
  MetadataConsts,
  TokenMetadata,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/encodedTokenAttributes';

export class TokenizerState implements monaco.languages.IState {
  constructor(public readonly ruleStack: StackElement) {}

  clone(): monaco.languages.IState {
    return new TokenizerState(this.ruleStack);
  }

  equals(other: monaco.languages.IState): boolean {
    return other instanceof TokenizerState && (other === this || other.ruleStack === this.ruleStack);
  }
}

/**
 * Options for the TextMate tokenizer.
 */
export interface TokenizerOption {
  /**
   * Maximum line length that will be handled by the TextMate tokenizer. If the length of the actual line exceeds this
   * limit, the tokenizer terminates and the tokenization of any subsequent lines might be broken.
   *
   * If the `lineLimit` is not defined, it means, there are no line length limits. Otherwise, it must be a positive
   * integer or an error will be thrown.
   */
  readonly lineLimit?: number;
}

export class TextMateTokenizer extends Disposable implements monaco.languages.EncodedTokensProvider {
  private readonly seenLanguages: boolean[];

  private readonly onDidEncounterLanguageEmitter: Emitter<number> = new Emitter<number>();
  public readonly onDidEncounterLanguage: Event<number> = this.onDidEncounterLanguageEmitter.event;

  constructor(
    private readonly grammar: IGrammar,
    private readonly options: TokenizerOption,
    private readonly conatinsEmbeddedLanguages?: boolean,
  ) {
    super();
    this.seenLanguages = [];
  }

  getInitialState(): monaco.languages.IState {
    return new TokenizerState(INITIAL);
  }

  tokenizeEncoded(line: string, state: TokenizerState): monaco.languages.IEncodedLineTokens {
    // copied from vscode/src/vs/editor/common/modes/nullMode.ts
    if (this.options.lineLimit !== undefined && line.length > this.options.lineLimit) {
      const tokens = new Uint32Array(2);
      tokens[0] = 0;
      tokens[1] =
        (1 << MetadataConsts.LANGUAGEID_OFFSET) |
        (0 << MetadataConsts.TOKEN_TYPE_OFFSET) |
        (0 << MetadataConsts.FONT_STYLE_OFFSET) |
        (1 << MetadataConsts.FOREGROUND_OFFSET) |
        (2 << MetadataConsts.BACKGROUND_OFFSET) |
        (MetadataConsts.BALANCED_BRACKETS_MASK >>> 0);
      // Line is too long to be tokenized
      return {
        endState: new TokenizerState(INITIAL),
        tokens,
      };
    }

    const result = this.grammar.tokenizeLine2(line, state.ruleStack, 500);

    if (this.conatinsEmbeddedLanguages) {
      const seenLanguages = this.seenLanguages;
      const tokens = result.tokens;

      // Must check if any of the embedded languages was hit
      for (let i = 0, len = tokens.length >>> 1; i < len; i++) {
        const metadata = tokens[(i << 1) + 1];
        const languageId = TokenMetadata.getLanguageId(metadata);
        if (!seenLanguages[languageId]) {
          seenLanguages[languageId] = true;
          this.onDidEncounterLanguageEmitter.fire(languageId);
        }
      }
    }

    return {
      endState: new TokenizerState(result.ruleStack),
      tokens: result.tokens,
    };
  }

  tokenize?(line: string, state: TokenizerState): monaco.languages.ILineTokens {
    const result = this.grammar.tokenizeLine(line, state.ruleStack);
    return {
      endState: new TokenizerState(result.ruleStack),
      tokens: result.tokens.map((t) => ({ ...t, scopes: t.scopes.join('\r\n') })),
    };
  }
}
