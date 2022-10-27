import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { localize, URI, Disposable } from '@opensumi/ide-core-common';
import { GrammarsContribution } from '@opensumi/ide-monaco';
import { ITextmateTokenizer, ITextmateTokenizerService } from '@opensumi/ide-monaco/lib/browser/contrib/tokenizer';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export type GrammarSchema = Array<GrammarsContribution>;

@Injectable()
@Contributes('grammars')
@LifeCycle(LifeCyclePhase.Initialize)
export class GrammarsContributionPoint extends VSCodeContributePoint<GrammarSchema> {
  @Autowired(ITextmateTokenizer)
  textMateService: ITextmateTokenizerService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }

      for (const grammar of contributes) {
        this.textMateService.registerGrammar(grammar, URI.from(extension.uri!));

        this.addDispose(
          Disposable.create(() => {
            this.textMateService.unregisterGrammar(grammar);
          }),
        );
      }
    }
  }

  static schema = {
    description: localize('vscode.extension.contributes.grammars', 'Contributes textmate tokenizers.'),
    type: 'array',
    defaultSnippets: [
      { body: [{ language: '${1:id}', scopeName: 'source.${2:id}', path: './syntaxes/${3:id}.tmLanguage.' }] },
    ],
    items: {
      type: 'object',
      defaultSnippets: [
        { body: { language: '${1:id}', scopeName: 'source.${2:id}', path: './syntaxes/${3:id}.tmLanguage.' } },
      ],
      properties: {
        language: {
          description: localize(
            'vscode.extension.contributes.grammars.language',
            'Language identifier for which this syntax is contributed to.',
          ),
          type: 'string',
        },
        scopeName: {
          description: localize(
            'vscode.extension.contributes.grammars.scopeName',
            'Textmate scope name used by the tmLanguage file.',
          ),
          type: 'string',
        },
        path: {
          description: localize(
            'vscode.extension.contributes.grammars.path',
            "Path of the tmLanguage file. The path is relative to the extension folder and typically starts with './syntaxes/'.",
          ),
          type: 'string',
        },
        embeddedLanguages: {
          description: localize(
            'vscode.extension.contributes.grammars.embeddedLanguages',
            'A map of scope name to language id if this grammar contains embedded languages.',
          ),
          type: 'object',
        },
        tokenTypes: {
          description: localize(
            'vscode.extension.contributes.grammars.tokenTypes',
            'A map of scope name to token types.',
          ),
          type: 'object',
          additionalProperties: {
            enum: ['string', 'comment', 'other'],
          },
        },
        injectTo: {
          description: localize(
            'vscode.extension.contributes.grammars.injectTo',
            'List of language scope names to which this grammar is injected to.',
          ),
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
      required: ['scopeName', 'path'],
    },
  };
}
