import * as React from 'react';
import MonacoServiceImpl from './monaco.service';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, MonacoService, MonacoContribution } from '@ali/ide-core-browser';

import { MonacoClientContribution } from './monaco.contribution';
import { JavascriptContribution } from './languages/js';
import { TypescriptContribution } from './languages/ts';
import { JsxTagsContribution } from './languages/jsx-tags';
import { CssContribution } from './languages/css';
import { HtmlContribution } from './languages/html';
import { LessContribution } from './languages/less';
import { MarkdownContribution } from './languages/markdown';
import { PythonContribution } from './languages/python';
import { ScssContribution } from './languages/scss';
import { XmlContribution } from './languages/xml';
import { JsonContribution } from './languages/json';
import { LanguageGrammarDefinitionContribution } from './textmate.service';

@Injectable()
export class MonacoModule extends BrowserModule {
  contributionProvider = [MonacoContribution, LanguageGrammarDefinitionContribution];

  providers: Provider[] = [
    MonacoClientContribution,
    {
      token: MonacoService,
      useClass: MonacoServiceImpl,
    },
    JavascriptContribution,
    TypescriptContribution,
    CssContribution,
    HtmlContribution,
    JsxTagsContribution,
    LessContribution,
    MarkdownContribution,
    PythonContribution,
    ScssContribution,
    XmlContribution,
    JsonContribution,
  ];
}
