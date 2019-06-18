import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { documentService } from '../common';
import { BrowserDocumentService } from './provider';
import { DocModelContribution } from './doc-model.contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class DocModelModule extends BrowserModule {
  providers = [
    DocModelContribution,
  ];

  backServices = [
    {
      servicePath: documentService,
      clientToken: BrowserDocumentService,
    },
  ];
}
