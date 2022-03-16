import { Injectable, Autowired } from '@opensumi/di';
import { localize, URI } from '@opensumi/ide-core-common';
import { LanguagesContribution } from '@opensumi/ide-monaco';
import { ITextmateTokenizer, ITextmateTokenizerService } from '@opensumi/ide-monaco/lib/browser/contrib/tokenizer';

import { VSCodeContributePoint, Contributes } from '../../../common';

export type LanguagesSchema = Array<LanguagesContribution>;

@Injectable()
@Contributes('languages')
export class LanguagesContributionPoint extends VSCodeContributePoint<LanguagesSchema> {
  @Autowired(ITextmateTokenizer)
  private readonly textMateService: ITextmateTokenizerService;

  async contribute() {
    await this.textMateService.registerLanguages(this.json, URI.from(this.extension.uri!));
  }

  // copied from vscode
  schema = {
    allowComments: true,
    allowTrailingCommas: true,
    default: {
      comments: {
        blockComment: ['/*', '*/'],
        lineComment: '//',
      },
      brackets: [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
      ],
      autoClosingPairs: [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
      ],
      surroundingPairs: [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
      ],
    },
    definitions: {
      openBracket: {
        type: 'string',
        description: localize('schema.openBracket', 'The opening bracket character or string sequence.'),
      },
      closeBracket: {
        type: 'string',
        description: localize('schema.closeBracket', 'The closing bracket character or string sequence.'),
      },
      bracketPair: {
        type: 'array',
        items: [
          {
            $ref: '#definitions/openBracket',
          },
          {
            $ref: '#definitions/closeBracket',
          },
        ],
      },
    },
    properties: {
      comments: {
        default: {
          blockComment: ['/*', '*/'],
          lineComment: '//',
        },
        description: localize('schema.comments', 'Defines the comment symbols'),
        type: 'object',
        properties: {
          blockComment: {
            type: 'array',
            description: localize('schema.blockComments', 'Defines how block comments are marked.'),
            items: [
              {
                type: 'string',
                description: localize(
                  'schema.blockComment.begin',
                  'The character sequence that starts a block comment.',
                ),
              },
              {
                type: 'string',
                description: localize('schema.blockComment.end', 'The character sequence that ends a block comment.'),
              },
            ],
          },
          lineComment: {
            type: 'string',
            description: localize('schema.lineComment', 'The character sequence that starts a line comment.'),
          },
        },
      },
      brackets: {
        default: [
          ['(', ')'],
          ['[', ']'],
          ['{', '}'],
        ],
        description: localize(
          'schema.brackets',
          'Defines the bracket symbols that increase or decrease the indentation.',
        ),
        type: 'array',
        items: {
          $ref: '#definitions/bracketPair',
        },
      },
      autoClosingPairs: {
        default: [
          ['(', ')'],
          ['[', ']'],
          ['{', '}'],
        ],
        description: localize(
          'schema.autoClosingPairs',
          'Defines the bracket pairs. When a opening bracket is entered, the closing bracket is inserted automatically.',
        ),
        type: 'array',
        items: {
          oneOf: [
            {
              $ref: '#definitions/bracketPair',
            },
            {
              type: 'object',
              properties: {
                open: {
                  $ref: '#definitions/openBracket',
                },
                close: {
                  $ref: '#definitions/closeBracket',
                },
                notIn: {
                  type: 'array',
                  description: localize(
                    'schema.autoClosingPairs.notIn',
                    'Defines a list of scopes where the auto pairs are disabled.',
                  ),
                  items: {
                    enum: ['string', 'comment'],
                  },
                },
              },
            },
          ],
        },
      },
      autoCloseBefore: {
        default: ';:.,=}])> \n\t',
        description: localize(
          'schema.autoCloseBefore',
          "Defines what characters must be after the cursor in order for bracket or quote autoclosing to occur when using the 'languageDefined' autoclosing setting. This is typically the set of characters which can not start an expression.",
        ),
        type: 'string',
      },
      surroundingPairs: {
        default: [
          ['(', ')'],
          ['[', ']'],
          ['{', '}'],
        ],
        description: localize(
          'schema.surroundingPairs',
          'Defines the bracket pairs that can be used to surround a selected string.',
        ),
        type: 'array',
        items: {
          oneOf: [
            {
              $ref: '#definitions/bracketPair',
            },
            {
              type: 'object',
              properties: {
                open: {
                  $ref: '#definitions/openBracket',
                },
                close: {
                  $ref: '#definitions/closeBracket',
                },
              },
            },
          ],
        },
      },
      wordPattern: {
        default: '',
        description: localize(
          'schema.wordPattern',
          'Defines what is considered to be a word in the programming language.',
        ),
        type: ['string', 'object'],
        properties: {
          pattern: {
            type: 'string',
            description: localize('schema.wordPattern.pattern', 'The RegExp pattern used to match words.'),
            default: '',
          },
          flags: {
            type: 'string',
            description: localize('schema.wordPattern.flags', 'The RegExp flags used to match words.'),
            default: 'g',
            pattern: '^([gimuy]+)$',
            patternErrorMessage: localize(
              'schema.wordPattern.flags.errorMessage',
              'Must match the pattern `/^([gimuy]+)$/`.',
            ),
          },
        },
      },
      indentationRules: {
        default: {
          increaseIndentPattern: '',
          decreaseIndentPattern: '',
        },
        description: localize('schema.indentationRules', "The language's indentation settings."),
        type: 'object',
        properties: {
          increaseIndentPattern: {
            type: ['string', 'object'],
            description: localize(
              'schema.indentationRules.increaseIndentPattern',
              'If a line matches this pattern, then all the lines after it should be indented once (until another rule matches).',
            ),
            properties: {
              pattern: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.increaseIndentPattern.pattern',
                  'The RegExp pattern for increaseIndentPattern.',
                ),
                default: '',
              },
              flags: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.increaseIndentPattern.flags',
                  'The RegExp flags for increaseIndentPattern.',
                ),
                default: '',
                pattern: '^([gimuy]+)$',
                patternErrorMessage: localize(
                  'schema.indentationRules.increaseIndentPattern.errorMessage',
                  'Must match the pattern `/^([gimuy]+)$/`.',
                ),
              },
            },
          },
          decreaseIndentPattern: {
            type: ['string', 'object'],
            description: localize(
              'schema.indentationRules.decreaseIndentPattern',
              'If a line matches this pattern, then all the lines after it should be unindented once (until another rule matches).',
            ),
            properties: {
              pattern: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.decreaseIndentPattern.pattern',
                  'The RegExp pattern for decreaseIndentPattern.',
                ),
                default: '',
              },
              flags: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.decreaseIndentPattern.flags',
                  'The RegExp flags for decreaseIndentPattern.',
                ),
                default: '',
                pattern: '^([gimuy]+)$',
                patternErrorMessage: localize(
                  'schema.indentationRules.decreaseIndentPattern.errorMessage',
                  'Must match the pattern `/^([gimuy]+)$/`.',
                ),
              },
            },
          },
          indentNextLinePattern: {
            type: ['string', 'object'],
            description: localize(
              'schema.indentationRules.indentNextLinePattern',
              'If a line matches this pattern, then **only the next line** after it should be indented once.',
            ),
            properties: {
              pattern: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.indentNextLinePattern.pattern',
                  'The RegExp pattern for indentNextLinePattern.',
                ),
                default: '',
              },
              flags: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.indentNextLinePattern.flags',
                  'The RegExp flags for indentNextLinePattern.',
                ),
                default: '',
                pattern: '^([gimuy]+)$',
                patternErrorMessage: localize(
                  'schema.indentationRules.indentNextLinePattern.errorMessage',
                  'Must match the pattern `/^([gimuy]+)$/`.',
                ),
              },
            },
          },
          unIndentedLinePattern: {
            type: ['string', 'object'],
            description: localize(
              'schema.indentationRules.unIndentedLinePattern',
              'If a line matches this pattern, then its indentation should not be changed and it should not be evaluated against the other rules.',
            ),
            properties: {
              pattern: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.unIndentedLinePattern.pattern',
                  'The RegExp pattern for unIndentedLinePattern.',
                ),
                default: '',
              },
              flags: {
                type: 'string',
                description: localize(
                  'schema.indentationRules.unIndentedLinePattern.flags',
                  'The RegExp flags for unIndentedLinePattern.',
                ),
                default: '',
                pattern: '^([gimuy]+)$',
                patternErrorMessage: localize(
                  'schema.indentationRules.unIndentedLinePattern.errorMessage',
                  'Must match the pattern `/^([gimuy]+)$/`.',
                ),
              },
            },
          },
        },
      },
      folding: {
        type: 'object',
        description: localize('schema.folding', "The language's folding settings."),
        properties: {
          offSide: {
            type: 'boolean',
            description: localize(
              'schema.folding.offSide',
              'A language adheres to the off-side rule if blocks in that language are expressed by their indentation. If set, empty lines belong to the subsequent block.',
            ),
          },
          markers: {
            type: 'object',
            description: localize(
              'schema.folding.markers',
              "Language specific folding markers such as '#region' and '#endregion'. The start and end regexes will be tested against the contents of all lines and must be designed efficiently",
            ),
            properties: {
              start: {
                type: 'string',
                description: localize(
                  'schema.folding.markers.start',
                  "The RegExp pattern for the start marker. The regexp must start with '^'.",
                ),
              },
              end: {
                type: 'string',
                description: localize(
                  'schema.folding.markers.end',
                  "The RegExp pattern for the end marker. The regexp must start with '^'.",
                ),
              },
            },
          },
        },
      },
    },
  };
}
