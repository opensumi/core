import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, Emitter, Event, IApplicationService, PreferenceService, URI } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelContentProvider,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser/doc-model/types';

import { BaseApplyService } from '../mcp/base-apply.service';

@Injectable()
export class ChatEditSchemeDocumentProvider implements IEditorDocumentModelContentProvider {
  @Autowired(IEditorDocumentModelService)
  editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  @Autowired(BaseApplyService)
  private readonly baseApplyService: BaseApplyService;

  private _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  handlesScheme(scheme: string): boolean {
    return scheme === BaseApplyService.CHAT_EDITING_SOURCE_RESOLVER_SCHEME;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined): Promise<string> {
    // Get the content from the base apply service based on the uri query parameters
    const { id, version } = uri.getParsedQuery();
    const codeBlock = this.baseApplyService.getCodeBlock(id);
    const content = +version === 1 ? codeBlock?.originalCode : codeBlock?.updatedCode;
    // console.log('codeBlock', codeBlock, id, version, content);
    return content || '';
  }

  isReadonly(uri: URI): boolean {
    return true;
  }

  onDidDisposeModel() {}
}
