import { Injectable } from '@opensumi/di';
import { IJSONSchema, IJSONSchemaMap } from '@opensumi/ide-core-common/lib/json-schema';
import { localize } from '@opensumi/ide-core-common/lib/localize';

import {
  fontStylePattern,
  getStylingSchemeEntry,
  ISemanticTokenRegistry,
  parseClassifierString,
  selectorPattern,
  SemanticTokenDefaultRule,
  TokenSelector,
  TokenStyleDefaults,
  TokenTypeOrModifierContribution,
  TOKEN_TYPE_WILDCARD,
  typeAndModifierIdPattern,
} from '../common/semantic-tokens-registry';

@Injectable()
export class SemanticTokenRegistryImpl implements ISemanticTokenRegistry {
  private typeHierarchy: { [id: string]: string[] } = Object.create(null);

  private tokenTypeById: { [key: string]: TokenTypeOrModifierContribution } = Object.create(null);
  private tokenModifierById: { [key: string]: TokenTypeOrModifierContribution } = Object.create(null);

  private currentTypeNumber = 0;
  private currentModifierBit = 1;

  private tokenStylingDefaultRules: SemanticTokenDefaultRule[] = [];

  private tokenStylingSchema: IJSONSchema & {
    properties: IJSONSchemaMap;
    patternProperties: IJSONSchemaMap;
  } = {
    type: 'object',
    properties: {},
    patternProperties: {
      [selectorPattern]: getStylingSchemeEntry(),
    },
    additionalProperties: false,
    definitions: {
      style: {
        type: 'object',
        description: localize('schema.token.settings', 'Colors and styles for the token.'),
        properties: {
          foreground: {
            type: 'string',
            description: localize('schema.token.foreground', 'Foreground color for the token.'),
            format: 'color-hex',
            default: '#ff0000',
          },
          background: {
            type: 'string',
            deprecationMessage: localize(
              'schema.token.background.warning',
              'Token background colors are currently not supported.',
            ),
          },
          fontStyle: {
            type: 'string',
            description: localize(
              'schema.token.fontStyle',
              "Sets the all font styles of the rule: 'italic', 'bold' or 'underline' or a combination. All styles that are not listed are unset. The empty string unsets all styles.",
            ),
            pattern: fontStylePattern,
            patternErrorMessage: localize(
              'schema.fontStyle.error',
              "Font style must be 'italic', 'bold' or 'underline' or a combination. The empty string unsets all styles.",
            ),
            defaultSnippets: [
              {
                label: localize('schema.token.fontStyle.none', 'None (clear inherited style)'),
                bodyText: '""',
              },
              { body: 'italic' },
              { body: 'bold' },
              { body: 'underline' },
              { body: 'italic underline' },
              { body: 'bold underline' },
              { body: 'italic bold underline' },
            ],
          },
          bold: {
            type: 'boolean',
            description: localize(
              'schema.token.bold',
              "Sets or unsets the font style to bold. Note, the presence of 'fontStyle' overrides this setting.",
            ),
          },
          italic: {
            type: 'boolean',
            description: localize(
              'schema.token.italic',
              "Sets or unsets the font style to italic. Note, the presence of 'fontStyle' overrides this setting.",
            ),
          },
          underline: {
            type: 'boolean',
            description: localize(
              'schema.token.underline',
              "Sets or unsets the font style to underline. Note, the presence of 'fontStyle' overrides this setting.",
            ),
          },
        },
        defaultSnippets: [{ body: { foreground: '${1:#FF0000}', fontStyle: '${2:bold}' } }],
      },
    },
  };

  parseTokenSelector(selectorString: string, language?: string): TokenSelector {
    const selector = parseClassifierString(selectorString, language);

    if (!selector.type) {
      return {
        match: () => -1,
        id: '$invalid',
      };
    }

    return {
      match: (type: string, modifiers: string[], language: string) => {
        let score = 0;
        if (selector.language !== undefined) {
          if (selector.language !== language) {
            return -1;
          }
          score += 10;
        }
        if (selector.type !== TOKEN_TYPE_WILDCARD) {
          const hierarchy = this.getTypeHierarchy(type);
          const level = hierarchy.indexOf(selector.type);
          if (level === -1) {
            return -1;
          }
          score += 100 - level;
        }
        // all selector modifiers must be present
        for (const selectorModifier of selector.modifiers) {
          if (modifiers.indexOf(selectorModifier) === -1) {
            return -1;
          }
        }
        return score + selector.modifiers.length * 100;
      },
      id: `${[selector.type, ...selector.modifiers.sort()].join('.')}${
        selector.language !== undefined ? ':' + selector.language : ''
      }`,
    };
  }

  registerTokenStyleDefault(selector: TokenSelector, defaults: TokenStyleDefaults): void {
    this.tokenStylingDefaultRules.push({ selector, defaults });
  }

  deregisterTokenStyleDefault(selector: TokenSelector): void {
    const selectorString = selector.id;
    this.tokenStylingDefaultRules = this.tokenStylingDefaultRules.filter((r) => r.selector.id !== selectorString);
  }

  getTokenStylingDefaultRules() {
    return this.tokenStylingDefaultRules;
  }

  registerTokenModifier(id: string, description: string, deprecationMessage?: string): void {
    if (!id.match(typeAndModifierIdPattern)) {
      throw new Error('Invalid token modifier id.');
    }

    const num = this.currentModifierBit;
    this.currentModifierBit = this.currentModifierBit * 2;
    const tokenStyleContribution: TokenTypeOrModifierContribution = {
      num,
      id,
      description,
      deprecationMessage,
    };
    this.tokenModifierById[id] = tokenStyleContribution;

    this.tokenStylingSchema.properties[`*.${id}`] = getStylingSchemeEntry(description, deprecationMessage);
  }

  registerTokenType(id: string, description: string, superType?: string, deprecationMessage?: string): void {
    if (!id.match(typeAndModifierIdPattern)) {
      throw new Error('Invalid token type id.');
    }
    if (superType && !superType.match(typeAndModifierIdPattern)) {
      throw new Error('Invalid token super type id.');
    }

    const num = this.currentTypeNumber++;
    const tokenStyleContribution: TokenTypeOrModifierContribution = {
      num,
      id,
      superType,
      description,
      deprecationMessage,
    };
    this.tokenTypeById[id] = tokenStyleContribution;

    const stylingSchemeEntry = getStylingSchemeEntry(description, deprecationMessage);
    this.tokenStylingSchema.properties[id] = stylingSchemeEntry;
    this.typeHierarchy = Object.create(null);
  }

  private getTypeHierarchy(typeId: string): string[] {
    let hierarchy = this.typeHierarchy[typeId];
    if (!hierarchy) {
      this.typeHierarchy[typeId] = hierarchy = [typeId];
      let type = this.tokenTypeById[typeId];
      while (type && type.superType) {
        hierarchy.push(type.superType);
        type = this.tokenTypeById[type.superType];
      }
    }
    return hierarchy;
  }
}
