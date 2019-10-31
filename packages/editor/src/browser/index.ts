import * as React from 'react';
import { BrowserModule, createContributionProvider, Domain, ClientAppContribution, ContributionProvider, MonacoContribution, IContextKeyService } from '@ali/ide-core-browser';
import { EditorView } from './editor.view';
import { EditorCollectionService, WorkbenchEditorService, ResourceService, ILanguageService } from '../common';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { Injectable, Provider, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { EditorContribution } from './editor.contribution';
import { ResourceServiceImpl } from './resource.service';
import { EditorComponentRegistry, BrowserEditorContribution, IEditorDecorationCollectionService, IEditorActionRegistry, ICompareService } from './types';
import { EditorComponentRegistryImpl } from './component';
import { DefaultDiffEditorContribution } from './diff';
import { EditorDecorationCollectionService } from './editor.decoration.service';
import { LanguageService } from './language/language.service';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService } from './doc-model/types';
import { EditorDocumentModelContentRegistryImpl, EditorDocumentModelServiceImpl } from './doc-model/main';
import { EditorActionRegistryImpl } from './menu/editor.menu';
import { IDocPersistentCacheProvider } from '../common/doc-cache';
import { EmptyDocCacheImpl, LocalStorageDocCacheImpl } from './doc-cache';
import { CompareService, CompareEditorContribution } from './diff/compare';
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
      token: IEditorActionRegistry,
      useClass: EditorActionRegistryImpl,
    },
    {
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
      // useClass: LocalStorageDocCacheImpl,
    },
    {
      token: ICompareService,
      useClass: CompareService,
      // useClass: LocalStorageDocCacheImpl,
    },
    DefaultDiffEditorContribution,
    EditorClientAppContribution,
    EditorContribution,
    CompareEditorContribution,
  ];
  contributionProvider = BrowserEditorContribution;

  component = EditorView;

}

@Domain(ClientAppContribution, MonacoContribution)
export class EditorClientAppContribution implements ClientAppContribution, MonacoContribution {

  @Autowired()
  resourceService!: ResourceService;

  @Autowired()
  editorComponentRegistry!: EditorComponentRegistry;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService!: WorkbenchEditorServiceImpl;

  @Autowired(IEditorDocumentModelContentRegistry)
  modelContentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(IEditorActionRegistry)
  editorActionRegistry: IEditorActionRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

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
      if (contribution.registerEditorActions) {
        contribution.registerEditorActions(this.editorActionRegistry);
      }
    }
    this.workbenchEditorService.contributionsReady.resolve();
    await this.workbenchEditorService.initialize();
  }

  onContextKeyServiceReady(contextKeyService: IContextKeyService) {
    // contextKeys
    const resourceScheme = contextKeyService.createKey<string>('resourceScheme', '');
    const resourceFilename = contextKeyService.createKey<string>('resourceFilename', '');
    const resourceExtname = contextKeyService.createKey<string>('resourceExtname', '');
    const resourceLangId = contextKeyService.createKey<string>('resourceLangId', '');
    const resourceKey = contextKeyService.createKey<string>('resource', '');
    const isFileSystemResource = contextKeyService.createKey<boolean>('isFileSystemResource', false);

    const setKeys = (resource) => {
      if (resource) {
        resourceScheme.set(resource.uri.scheme);
        resourceFilename.set(resource.uri.path.name);
        resourceExtname.set(resource.uri.path.ext);
        const langId = this.workbenchEditorService.currentEditor ? this.workbenchEditorService.currentEditor.currentDocumentModel!.languageId : '';
        resourceLangId.set(langId);
        resourceKey.set(resource.uri.toString());
        isFileSystemResource.set(resource.uri.scheme === 'file'); // TOOD FileSystemClient.canHandle
      } else {
        resourceScheme.set('');
        resourceFilename.set('');
        resourceExtname.set('');
        resourceLangId.set('');
        resourceKey.set('');
        isFileSystemResource.set(false); // TOOD FileSystemClient.canHandle
      }
    };

    this.workbenchEditorService.onActiveResourceChange((resource) => {
      setKeys(resource);
    });

    setKeys(this.workbenchEditorService.currentResource);
  }

}
