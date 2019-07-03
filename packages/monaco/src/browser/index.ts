import * as React from 'react';
import MonacoServiceImpl from './monaco.service';
import { createMonacoServiceProvider, MonacoContribution } from '../common';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

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

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class MonacoModule extends BrowserModule {
  contributionProvider = [MonacoContribution, LanguageGrammarDefinitionContribution];

  providers: Provider[] = [
    MonacoClientContribution,
    createMonacoServiceProvider(MonacoServiceImpl),
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
