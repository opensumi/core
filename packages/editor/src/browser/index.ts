import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Provider } from '@opensumi/di';
import {
  BrowserModule,
  ClientAppContribution,
  ContributionProvider,
  Domain,
  PreferenceService,
  createPreferenceProxy,
} from '@opensumi/ide-core-browser';
import { ICallHierarchyService } from '@opensumi/ide-monaco/lib/browser/contrib/callHierarchy';
import {
  ICommandServiceToken,
  IMonacoActionRegistry,
  IMonacoCommandsRegistry,
} from '@opensumi/ide-monaco/lib/browser/contrib/command';
import { ITextmateTokenizer } from '@opensumi/ide-monaco/lib/browser/contrib/tokenizer';
import { ITypeHierarchyService } from '@opensumi/ide-monaco/lib/browser/contrib/typeHierarchy';

import { EditorCollectionService, ILanguageService, ResourceService, WorkbenchEditorService } from '../common';
import { IDocPersistentCacheProvider } from '../common/doc-cache';

import { BreadCrumbServiceImpl } from './breadcrumb';
import { EditorComponentRegistryImpl } from './component';
import { DefaultDiffEditorContribution } from './diff';
import { CompareEditorContribution, CompareService } from './diff/compare';
import { EmptyDocCacheImpl } from './doc-cache';
import { EditorDocumentModelContentRegistryImpl, EditorDocumentModelServiceImpl } from './doc-model/main';
import { SaveParticipantsContribution } from './doc-model/saveParticipants';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService } from './doc-model/types';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { EditorElectronContribution } from './editor-electron.contribution';
import { EditorAutoSaveEditorContribution, EditorContribution } from './editor.contribution';
import { EditorDecorationCollectionService } from './editor.decoration.service';
import { EditorTabService } from './editor.tab.service';
import { EditorFeatureRegistryImpl } from './feature';
import { FileSystemResourceContribution } from './fs-resource';
import { LanguageStatusContribution } from './language/language-status.contribution';
import { LanguageStatusService } from './language/language-status.service';
import { LanguageService } from './language/language.service';
import { EditorActionRegistryImpl } from './menu/editor.menu';
import { OpenTypeMenuContribution } from './menu/open-type-menu.contribution';
import { MergeEditorContribution } from './merge-editor/merge-editor.contribution';
import {
  CallHierarchyContribution,
  CallHierarchyService,
  TypeHierarchyContribution,
  TypeHierarchyService,
} from './monaco-contrib';
import {
  MonacoActionRegistry,
  MonacoCommandRegistry,
  MonacoCommandService,
} from './monaco-contrib/command/command.service';
import { TextmateService } from './monaco-contrib/tokenizer/textmate.service';
import { NotebookService } from './notebook.service';
import { EditorPreferenceContribution } from './preference/contribution';
import { EditorPreferences, editorPreferenceSchema } from './preference/schema';
import { ResourceServiceImpl } from './resource.service';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IBreadCrumbService,
  ICompareService,
  IEditorActionRegistry,
  IEditorDecorationCollectionService,
  IEditorFeatureRegistry,
  IEditorTabService,
  ILanguageStatusService,
  INotebookService,
} from './types';
import { UntitledDocumentIdCounter } from './untitled-resource';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
export * from './doc-cache';
export * from './doc-model/types';
export * from './editor.less';
export * from './preference/schema';
export * from './types';
export * from './view/editor.react';

@Injectable()
export class EditorModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: EditorCollectionService,
      useClass: EditorCollectionServiceImpl,
    },
    {
      token: UntitledDocumentIdCounter,
      useClass: UntitledDocumentIdCounter,
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
      useClass: EditorDecorationCollectionService,
    },
    {
      token: IEditorDocumentModelContentRegistry,
      useClass: EditorDocumentModelContentRegistryImpl,
    },
    {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
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
    },
    {
      token: IBreadCrumbService,
      useClass: BreadCrumbServiceImpl,
    },
    {
      token: IEditorFeatureRegistry,
      useClass: EditorFeatureRegistryImpl,
    },
    {
      token: EditorPreferences,
      useFactory: (inject: Injector) => {
        const preferences: PreferenceService = inject.get(PreferenceService);
        return createPreferenceProxy(preferences, editorPreferenceSchema);
      },
    },
    {
      token: ICallHierarchyService,
      useClass: CallHierarchyService,
    },
    {
      token: ITypeHierarchyService,
      useClass: TypeHierarchyService,
    },
    {
      token: ICommandServiceToken,
      useClass: MonacoCommandService,
    },
    {
      token: IMonacoCommandsRegistry,
      useClass: MonacoCommandRegistry,
    },
    {
      token: IMonacoActionRegistry,
      useClass: MonacoActionRegistry,
    },
    {
      token: ITextmateTokenizer,
      useClass: TextmateService,
    },
    {
      token: ILanguageStatusService,
      useClass: LanguageStatusService,
    },
    {
      token: IEditorTabService,
      useClass: EditorTabService,
    },
    {
      token: INotebookService,
      useClass: NotebookService,
    },
    EditorPreferenceContribution,
    DefaultDiffEditorContribution,
    MergeEditorContribution,
    EditorClientAppContribution,
    EditorContribution,
    CompareEditorContribution,
    EditorAutoSaveEditorContribution,
    SaveParticipantsContribution,
    FileSystemResourceContribution,
    CallHierarchyContribution,
    TypeHierarchyContribution,
    LanguageStatusContribution,
    OpenTypeMenuContribution,
  ];
  electronProviders = [EditorElectronContribution];
  contributionProvider = BrowserEditorContribution;
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

  @Autowired(IEditorActionRegistry)
  editorActionRegistry: IEditorActionRegistry;

  @Autowired(IEditorFeatureRegistry)
  editorFeatureRegistry: IEditorFeatureRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IEditorDocumentModelService)
  modelService: EditorDocumentModelServiceImpl;

  @Autowired(BrowserEditorContribution)
  private readonly contributions: ContributionProvider<BrowserEditorContribution>;

  async initialize() {
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
      if (contribution.registerEditorFeature) {
        contribution.registerEditorFeature(this.editorFeatureRegistry);
      }
    }
    this.workbenchEditorService.contributionsReady.resolve();
    await Promise.all([this.workbenchEditorService.initialize(), this.modelService.initialize()]);
  }

  async onDidStart() {
    this.workbenchEditorService.prepareContextKeyService();
  }
}
