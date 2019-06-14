import * as React from 'react';
import { BrowserModule, createContributionProvider, Domain, ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { EditorView } from './editor.view';
import { EditorCollectionService, WorkbenchEditorService, ResourceService } from '../common';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { Injectable, Provider, Autowired } from '@ali/common-di';
import { EditorContribution } from './editor.contribution';
import { ResourceServiceImpl } from './resource.service';
import { EditorComponentRegistry, BrowserEditorContribution } from './types';
import { EditorComponentRegistryImpl } from './component';
import { DefaultDiffEditorContribution } from './diff';
export * from './types';

@Injectable()
export class EditorModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: EditorCollectionService,
      useClass: EditorCollectionServiceImpl,
    },
    {
      token: WorkbenchEditorService,
      useClass: WorkbenchEditorServiceImpl,
    },
    {
      token: ResourceService,
      useClass: ResourceServiceImpl,
    },
    {
      token: EditorComponentRegistry,
      useClass: EditorComponentRegistryImpl,
    },
    DefaultDiffEditorContribution,
    EditorClientAppContribution,
    EditorContribution,
  ];
  slotMap = new Map([
    [
      SlotLocation.topPanel, EditorView,
    ],
  ]);

  contributionProvider = BrowserEditorContribution;

}

@Domain(ClientAppContribution)
export class EditorClientAppContribution implements ClientAppContribution {

  @Autowired()
  resourceService!: ResourceService;

  @Autowired()
  editorComponentRegistry!: EditorComponentRegistry;

  @Autowired(BrowserEditorContribution)
  private readonly contributions: ContributionProvider<BrowserEditorContribution>;

  onStart() {
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.registerResource) {
        contribution.registerResource(this.resourceService);
      }
      if (contribution.registerComponent) {
        contribution.registerComponent(this.editorComponentRegistry);
      }
    }
  }
}
