import * as React from 'react';
import { Provider, Autowired } from '@ali/common-di';
import {
  BrowserModule,
  EffectDomain,
  Domain,
  ClientAppContribution,
  ContributionProvider,
} from '@ali/ide-core-browser';
import { documentService, IDocumentModelManager, BrowserDocumentModelContribution, IBrowserDocumentService } from '../common';
import { BrowserDocumentService } from './provider';
import { DocumentModelManager, BrowserDocumentModelContributionImpl } from './doc-manager';
import { DocModelContribution } from './doc-model.contribution';
import { RawFileProvider, EmptyProvider } from './provider';
import { Disposable } from '@ali/ide-core-common';
export * from './event';

const pkgJson = require('../../package.json');

@EffectDomain(pkgJson.name)
export class DocModelModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IDocumentModelManager,
      useClass: DocumentModelManager,
    },
    {
      token: IBrowserDocumentService,
      useClass: BrowserDocumentService,
    },
    DocModelContribution,
    BrowserDocumentModelContributionImpl,
    BrowserDocumentModelClienAppContribution,
  ];

  backServices = [
    {
      clientToken: IBrowserDocumentService,
      servicePath: documentService,
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

  private toDispose = new Disposable();

  onStart() {
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.registerDocModelContentProvider) {
        this.toDispose.addDispose(contribution.registerDocModelContentProvider(this.rawFileProvider));
        this.toDispose.addDispose(contribution.registerDocModelContentProvider(this.emptyProvider));
      }
    }
  }

  onStop() {
    this.toDispose.dispose();
  }
}
