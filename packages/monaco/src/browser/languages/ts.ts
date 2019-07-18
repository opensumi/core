/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Domain } from '@ali/ide-core-browser';
import { TextmateRegistry } from '../textmate-registry';
import { LanguageGrammarDefinitionContribution } from '../textmate.service';
import { ActivationEventService } from '@ali/ide-activation-event';
import { Autowired } from '@ali/common-di';


@Domain(LanguageGrammarDefinitionContribution)
export class TypescriptContribution implements LanguageGrammarDefinitionContribution {
    private readonly TS_ID = 'typescript';
    private readonly TS_REACT_ID = 'typescriptreact';

    @Autowired()
    private activationService: ActivationEventService;
    // @Autowired(MonacoSnippetSuggestProvider)
    // protected readonly snippetSuggestProvider: MonacoSnippetSuggestProvider;

    registerTextmateLanguage(registry: TextmateRegistry) {
        this.registerTypeScript();
        // this.registerSnippets();
        const grammar = require('../../data/typescript.tmlanguage.json');
        registry.registerTextmateGrammarScope('source.ts', {
            async getGrammarDefinition() {
                return {
                    format: 'json',
                    content: grammar,
                };
            }
        });

        registry.mapLanguageIdToTextmateGrammar(this.TS_ID, 'source.ts');
        registry.registerGrammarConfiguration(this.TS_ID, {
            tokenTypes: {
                'entity.name.type.instance.jsdoc': 0,
                'entity.name.function.tagged-template': 0,
                'meta.import string.quoted': 0,
                'variable.other.jsdoc': 0
            }
        });

        const jsxGrammar = require('../../data/typescript.tsx.tmlanguage.json');
        registry.registerTextmateGrammarScope('source.tsx', {
            async getGrammarDefinition() {
                return {
                    format: 'json',
                    content: jsxGrammar,
                };
            }
        });

        registry.mapLanguageIdToTextmateGrammar(this.TS_REACT_ID, 'source.tsx');
    }

    // TODO snippetSuggest support
    // protected registerSnippets(): void {
    //     const snippets = require('../../data/snippets/typescript.json');
    //     this.snippetSuggestProvider.fromJSON(snippets, {
    //         language: [this.TS_ID, this.TS_REACT_ID],
    //         source: 'TypeScript Language'
    //     });
    // }

    protected registerTypeScript() {
        monaco.languages.register({
            id: this.TS_ID,
            aliases: [
                'TypeScript',
                'typescript',
                'ts'
            ],
            extensions: [
                '.ts'
            ],
            mimetypes: [
                'text/typescript'
            ]
        });

        monaco.languages.onLanguage(this.TS_ID, () => {
            this.activationService.fireEvent("onLanguage", this.TS_ID);
            monaco.languages.setLanguageConfiguration(this.TS_ID, this.configuration);
        });

        monaco.languages.register({
            id: this.TS_REACT_ID,
            aliases: [
                'TypeScript React',
                'tsx'
            ],
            extensions: [
                '.tsx'
            ]
        });
        monaco.languages.onLanguage(this.TS_REACT_ID, () => {
            monaco.languages.setLanguageConfiguration(this.TS_REACT_ID, this.configuration);
        });
    }

    protected configuration: monaco.languages.LanguageConfiguration = {
        'comments': {
            'lineComment': '//',
            'blockComment': ['/*', '*/']
        },
        'brackets': [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
        ],
        'autoClosingPairs': [
            { 'open': '{', 'close': '}' },
            { 'open': '[', 'close': ']' },
            { 'open': '(', 'close': ')' },
            { 'open': "'", 'close': "'", 'notIn': ['string', 'comment'] },
            { 'open': '"', 'close': '"', 'notIn': ['string'] },
            { 'open': '`', 'close': '`', 'notIn': ['string', 'comment'] },
            { 'open': '/**', 'close': ' */', 'notIn': ['string'] }
        ],
        'surroundingPairs': [
            { 'open': '{', 'close': '}' },
            { 'open': '[', 'close': ']' },
            { 'open': '(', 'close': ')' },
            { 'open': "'", 'close': "'" },
            { 'open': '"', 'close': '"' },
            { 'open': '`', 'close': '`' }
        ],
        'folding': {
            'markers': {
                'start': new RegExp('^\\s*//\\s*#?region\\b'),
                'end': new RegExp('^\\s*//\\s*#?endregion\\b')
            }
        }
    };
}
