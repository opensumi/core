import * as React from 'react';
import { BrowserModule, createContributionProvider, Domain, ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { EditorView } from './editor.view';
import { EditorCollectionService, WorkbenchEditorService, ResourceService, ILanguageService } from '../common';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { Injectable, Provider, Autowired } from '@ali/common-di';
import { EditorContribution } from './editor.contribution';
import { ResourceServiceImpl } from './resource.service';
import { EditorComponentRegistry, BrowserEditorContribution, IEditorDecorationCollectionService } from './types';
import { EditorComponentRegistryImpl } from './component';
import { DefaultDiffEditorContribution } from './diff';
import { EditorDecorationCollectionService } from './editor.decoration.service';
import { LanguageService } from './language/language.service';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService } from './doc-model/types';
import { EditorDocumentModelContentRegistryImpl, EditorDocumentModelServiceImpl } from './doc-model/main';
import { IDocPersistentCacheProvider } from '../common/doc-cache';
import { EmptyDocCacheImpl, LocalStorageDocCacheImpl } from './doc-cache';
export * from './types';
export * from './doc-model/types';
export * from './doc-cache';

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
    {
      token: IEditorDecorationCollectionService,
      useClass : EditorDecorationCollectionService,
    },
    {
      token: IEditorDocumentModelContentRegistry,
      useClass : EditorDocumentModelContentRegistryImpl,
    },
    {
      token: IEditorDocumentModelService,
      useClass : EditorDocumentModelServiceImpl,
    },
    {
      token: ILanguageService,
      useClass: LanguageService,
    },
    {
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
      // useClass: LocalStorageDocCacheImpl,
    },
    DefaultDiffEditorContribution,
    EditorClientAppContribution,
    EditorContribution,
  ];
  contributionProvider = BrowserEditorContribution;

  component = EditorView;

}

@Domain(ClientAppContribution)
export class EditorClientAppContribution implements ClientAppContribution {

  @Autowired()
  resourceService!: ResourceService;

  @Autowired()
  editorComponentRegistry!: EditorComponentRegistry;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService!: WorkbenchEditorServiceImpl;

  @Autowired(IEditorDocumentModelContentRegistry)
  modelContentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(BrowserEditorContribution)
  private readonly contributions: ContributionProvider<BrowserEditorContribution>;

  async onStart() {
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.registerResource) {
        contribution.registerResource(this.resourceService);
      }
      if (contribution.registerEditorComponent) {
        contribution.registerEditorComponent(this.editorComponentRegistry);
      }
      if (contribution.registerEditorDocumentModelContentProvider) {
        contribution.registerEditorDocumentModelContentProvider(this.modelContentRegistry);
      }
    }
    this.workbenchEditorService.contributionsReady.resolve();
    await this.workbenchEditorService.initialize();
  }
}
