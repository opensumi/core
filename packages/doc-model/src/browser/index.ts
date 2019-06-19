import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { documentService } from '../common';
import { BrowserDocumentService } from './provider';
import { DocModelContribution } from './doc-model.contribution';
export * from './event';

@Injectable()
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
