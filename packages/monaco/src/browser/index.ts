import * as React from 'react';
import MonacoServiceImpl from './monaco.service';
import { createMonacoServiceProvider } from '../common';
import { Injectable, Provider } from '@ali/common-di';
export { default as MonacoService } from './monaco.service';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

import {JavascriptContribution} from './languages/js';
import {TypescriptContribution} from './languages/ts';
import {JsxTagsContribution} from './languages/jsx-tags';
import {CssContribution} from './languages/css';
import {HtmlContribution} from './languages/html';
import {LessContribution} from './languages/less';
import {MarkdownContribution} from './languages/markdown';
import {PythonContribution} from './languages/python';
import {ScssContribution} from './languages/scss';
import {XmlContribution} from './languages/xml';
import { JsonContribution } from './languages/json';
import { LanguageGrammarDefinitionContribution } from './textmate.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class MonacoModule extends BrowserModule {
  contributionProvider = LanguageGrammarDefinitionContribution;

  providers: Provider[] = [
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
