import * as React from 'react';
import { BrowserModule, createContributionProvider, Domain, ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { EditorView } from './editor.view';
import { EditorCollectionService, WorkbenchEditorService, ResourceService } from '../common';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { Injectable, Provider, Autowired } from '@ali/common-di';
import { EditorCommandContribution } from './editor.contribution';
import { ResourceServiceImpl } from './resource.service';
import { EditorComponentRegistry, BrowserEditorContribution, BrowserEditorContributionProvider } from './types';
import { EditorComponentRegistryImpl } from './component';
import { FileSystemEditorContribution } from './file';
import { DefaultDiffEditorContribution } from './diff';

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
    EditorCommandContribution,
    FileSystemEditorContribution,
    DefaultDiffEditorContribution,
    EditorClientAppContribution,
  ];
  slotMap = new Map([
    [
      SlotLocation.topPanel, EditorView,
    ],
  ]);

  constructor() {
    super();
    createContributionProvider(this.injector, BrowserEditorContribution, BrowserEditorContributionProvider);
  }
}

@Injectable()
@Domain(ClientAppContribution)
export class EditorClientAppContribution implements ClientAppContribution {

  @Autowired()
  resourceService!: ResourceService;

  @Autowired()
  editorComponentRegistry!: EditorComponentRegistry;

  @Autowired(BrowserEditorContributionProvider)
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
