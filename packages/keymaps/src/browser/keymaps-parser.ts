import Ajv from 'ajv';
import * as parser from 'jsonc-parser';

import { Injectable } from '@opensumi/di';

import { KeymapItem } from '../common';

export const keymapsSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      // 为了兼容 vscode，优先使用 key
      key: {
        type: 'string',
      },
      keybinding: {
        type: 'string',
        deprecated: true,
      },
      command: {
        type: 'string',
      },
      context: {
        type: 'string',
      },
      when: {
        type: 'string',
      },
      args: {},
    },
    required: ['command'],
    optional: ['key', 'keybinding', 'when', 'args'],
    additionalProperties: false,
  },
};

@Injectable()
export class KeymapsParser {
  protected readonly validate: Ajv.ValidateFunction;

  constructor() {
    // https://github.com/epoberezkin/ajv#validation-and-reporting-options
    this.validate = new Ajv({
      jsonPointers: true,
    }).compile(keymapsSchema);
  }

  /**
   * 解析快捷键，存储潜在的错误
   * @param content 内容.
   * @param errors 可选的错误存储指针.
   */
  parse(content: string, errors?: string[]): KeymapItem[] {
    const strippedContent = parser.stripComments(content);
    const parsingErrors: parser.ParseError[] | undefined = errors ? [] : undefined;
    const bindings = parser.parse(strippedContent, parsingErrors);
    if (parsingErrors && errors) {
      for (const error of parsingErrors) {
        errors.push(`${this.printParseErrorCode(error.error)} at ${error.offset} offset of ${error.length} length`);
      }
    }
    if (this.validate(bindings)) {
      return bindings;
    }
    if (errors && this.validate.errors) {
      for (const error of this.validate.errors) {
        errors.push(`${error.message} at ${error.dataPath}`);
      }
    }
    return [];
  }

  /**
   * 输出解析的错误代码
   * @param code 错误码
   */
  // https://github.com/Microsoft/node-jsonc-parser/issues/13
  protected printParseErrorCode(code: number | undefined) {
    switch (code) {
      case parser.ParseErrorCode.InvalidSymbol:
        return 'InvalidSymbol';
      case parser.ParseErrorCode.InvalidNumberFormat:
        return 'InvalidNumberFormat';
      case parser.ParseErrorCode.PropertyNameExpected:
        return 'PropertyNameExpected';
      case parser.ParseErrorCode.ValueExpected:
        return 'ValueExpected';
      case parser.ParseErrorCode.ColonExpected:
        return 'ColonExpected';
      case parser.ParseErrorCode.CommaExpected:
        return 'CommaExpected';
      case parser.ParseErrorCode.CloseBraceExpected:
        return 'CloseBraceExpected';
      case parser.ParseErrorCode.CloseBracketExpected:
        return 'CloseBracketExpected';
      case parser.ParseErrorCode.EndOfFileExpected:
        return 'EndOfFileExpected';
      case parser.ParseErrorCode.InvalidCommentToken:
        return 'InvalidCommentToken';
      case parser.ParseErrorCode.UnexpectedEndOfComment:
        return 'UnexpectedEndOfComment';
      case parser.ParseErrorCode.UnexpectedEndOfString:
        return 'UnexpectedEndOfString';
      case parser.ParseErrorCode.UnexpectedEndOfNumber:
        return 'UnexpectedEndOfNumber';
      case parser.ParseErrorCode.InvalidUnicode:
        return 'InvalidUnicode';
      case parser.ParseErrorCode.InvalidEscapeCharacter:
        return 'InvalidEscapeCharacter';
      case parser.ParseErrorCode.InvalidCharacter:
        return 'InvalidCharacter';
    }
    return '<unknown ParseErrorCode>';
  }
}
