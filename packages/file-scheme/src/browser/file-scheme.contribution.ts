import { ResourceService, IResourceProvider, IResource, ResourceNeedUpdateEvent, IEditorOpenType } from '@ali/ide-editor';
import { URI, MaybePromise, Domain, WithEventBus, localize, MessageType } from '@ali/ide-core-browser';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { EditorComponentRegistry, BrowserEditorContribution, IEditorDocumentModelService, IEditorDocumentModelContentRegistry } from '@ali/ide-editor/lib/browser';
import { ImagePreview } from './preview.view';
import { BinaryEditorComponent } from './external.view';
import { FILE_SCHEME, FILE_ON_DISK_SCHEME } from '../common';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { FileChangeType } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { Path } from '@ali/ide-core-common/lib/path';
import { IDialogService } from '@ali/ide-overlay';
import { FileSchemeDocumentProvider } from './file-doc';

const IMAGE_PREVIEW_COMPONENT_ID = 'image-preview';
const EXTERNAL_OPEN_COMPONENT_ID = 'external-file';

@Injectable()
export class FileSystemResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = FILE_SCHEME;

  @Autowired()
  labelService: LabelService;

  @Autowired(IFileServiceClient)
  fileServiceClient: IFileServiceClient;

  @Autowired(IDialogService)
  dialogService: IDialogService;

  @Autowired(IEditorDocumentModelService)
  documentModelService: IEditorDocumentModelService;

  constructor() {
    super();
    this.fileServiceClient.onFilesChanged((e) => {
      e.forEach((change) => {
        if (change.type === FileChangeType.ADDED || change.type === FileChangeType.DELETED) {
          this.eventBus.fire(new ResourceNeedUpdateEvent(new URI(change.uri)));
        }
      });
    });
  }

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    // 获取文件类型 getFileType: (path: string) => string
    return Promise.all([this.fileServiceClient.getFileStat(uri.toString()), this.labelService.getName(uri), this.labelService.getIcon(uri)]).then(([stat, name, icon]) => {
      return {
        name: stat ? name : (name + localize('file.resource-deleted', '(已删除)')),
        icon,
        uri,
        metadata: null,
      };
    });
  }

  provideResourceSubname(resource: IResource, groupResources: IResource[]): string | null {
    const shouldDiff: URI[] = [];
    for (const res of groupResources) {
      if (res.uri.scheme === FILE_SCHEME && res.uri.displayName === resource.uri.displayName && res !== resource) {
        // 存在file协议的相同名称的文件
        shouldDiff.push(res.uri);
      }
    }
    if (shouldDiff.length > 0) {
      return '...' + Path.separator + getMinimalDiffPath(resource.uri, shouldDiff);
    } else {
      return null;
    }
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    let count = 0;
    for (const resources of openedResources) {
      for (const r of resources) {
        if (r.uri.scheme === FILE_SCHEME && r.uri.toString() === resource.uri.toString()) {
          count ++;
        }
        if (count > 1) {
          return true;
        }
      }
    }
    const documentModelRef = this.documentModelService.getModelReference(resource.uri, 'close-resource-check');
    if (!documentModelRef || !documentModelRef.instance.dirty) {
      if (documentModelRef) {
        documentModelRef.dispose();
      }
      return true;
    }
    // 询问用户是否保存
    const buttons = {
      [localize('dontSave', '不保存')]: AskSaveResult.REVERT,
      [localize('save', '保存')]: AskSaveResult.SAVE,
      [localize('cancel', '取消')]: AskSaveResult.CANCEL,
    };
    const selection = await this.dialogService.open(localize('saveChangesMessage').replace('{0}', resource.name), MessageType.Info, Object.keys(buttons));
    const result = buttons[selection!];
    if (result === AskSaveResult.SAVE) {
      await documentModelRef.instance.save();
      documentModelRef.dispose();
      return true;
    } else if (result === AskSaveResult.REVERT) {
      await documentModelRef.instance.revert();
      documentModelRef.dispose();
      return true;
    } else if (result === AskSaveResult.CANCEL) {
      documentModelRef.dispose();
      return false;
    }
    return true;
  }
}

/**
 * 找到source文件url和中从末尾开始和target不一样的path
 * @param source
 * @param targets
 */
function getMinimalDiffPath(source: URI, targets: URI[]): string {
  const sourceDirPartsReverse = source.path.dir.toString().split(Path.separator).reverse();
  const targetDirPartsReverses = targets.map((target) => {
    return target.path.dir.toString().split(Path.separator).reverse();
  });
  for (let i = 0; i < sourceDirPartsReverse.length; i ++ ) {
    let foundSame = false;
    for (const targetDirPartsReverse of targetDirPartsReverses) {
      if (targetDirPartsReverse[i] === sourceDirPartsReverse[i]) {
        foundSame = true;
        break;
      }
    }
    if (!foundSame) {
      return sourceDirPartsReverse.slice(0, i + 1).reverse().join(Path.separator);
    }
  }
  return sourceDirPartsReverse.reverse().join(Path.separator);
}

@Domain(BrowserEditorContribution)
export class FileSystemEditorContribution implements BrowserEditorContribution {

  @Autowired()
  fileSystemResourceProvider: FileSystemResourceProvider;

  @Autowired()
  fileSchemeDocumentProvider: FileSchemeDocumentProvider;

  @Autowired(IFileServiceClient)
  fileServiceClient: IFileServiceClient;

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.fileSystemResourceProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    editorComponentRegistry.registerEditorComponent({
      component: ImagePreview,
      uid: IMAGE_PREVIEW_COMPONENT_ID,
      scheme: FILE_SCHEME,
    });

    editorComponentRegistry.registerEditorComponent({
      component: BinaryEditorComponent,
      uid: EXTERNAL_OPEN_COMPONENT_ID,
      scheme: FILE_SCHEME,
    });

    // 如果文件无法在当前IDE编辑器中找到打开方式
    editorComponentRegistry.registerEditorComponentResolver(FILE_SCHEME, (resource: IResource<any>, results: IEditorOpenType[]) => {
      if (results.length === 0) {
        results.push({
          type: 'component',
          componentId: EXTERNAL_OPEN_COMPONENT_ID,
        });
      }
    });

    // 图片文件
    editorComponentRegistry.registerEditorComponentResolver(FILE_SCHEME, async (resource: IResource<any>, results: IEditorOpenType[]) => {
      const type = await this.fileServiceClient.getFileType(resource.uri.toString()) as string | undefined;
      if (type === 'image') {
        results.push({
          type: 'component',
          componentId: IMAGE_PREVIEW_COMPONENT_ID,
        });
      }
      if (type === 'text') {
        results.push({
          type: 'code',
          title: localize('editorOpenType.code'),
        });
      }
    });

  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.fileSchemeDocumentProvider);
  }
}

enum AskSaveResult {
  REVERT = 1,
  SAVE = 2,
  CANCEL = 3,
}
