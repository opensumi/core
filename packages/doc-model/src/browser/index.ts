import * as React from 'react';
import { Provider, Autowired } from '@ali/common-di';
import {
  BrowserModule,
  EffectDomain,
  Domain,
  ClientAppContribution,
  ContributionProvider,
} from '@ali/ide-core-browser';
import { documentService, BrowserDocumentModelContribution } from '../common';
import { BrowserDocumentService } from './provider';
import { BrowserDocumentModelContributionImpl } from './doc-manager';
import { DocModelContribution } from './doc-model.contribution';
import { RawFileProvider, EmptyProvider } from './provider';
export * from './event';

const pkgJson = require('../../package.json');

@EffectDomain(pkgJson.name)
export class DocModelModule extends BrowserModule {
  providers: Provider[] = [
    DocModelContribution,
    BrowserDocumentModelContributionImpl,
    BrowserDocumentModelClienAppContribution,
  ];

  backServices = [
    {
      servicePath: documentService,
      clientToken: BrowserDocumentService,
    },
  ];

  contributionProvider = BrowserDocumentModelContribution;
}

@Domain(ClientAppContribution)
export class BrowserDocumentModelClienAppContribution implements ClientAppContribution {
  @Autowired()
  private rawFileProvider: RawFileProvider;

  @Autowired()
  private emptyProvider: EmptyProvider;

  @Autowired(BrowserDocumentModelContribution)
  private readonly contributions: ContributionProvider<BrowserDocumentModelContribution>;

  onStart() {
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.registerDocModelContentProvider) {
        contribution.registerDocModelContentProvider(this.rawFileProvider);
        contribution.registerDocModelContentProvider(this.emptyProvider);
      }
    }
  }
}
