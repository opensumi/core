import { ResourceService, IResourceProvider, IResource, ResourceNeedUpdateEvent } from '@ali/ide-editor';
import { URI, MaybePromise, Domain, WithEventBus, localize } from '@ali/ide-core-browser';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { EditorComponentRegistry, IEditorOpenType, BrowserEditorContribution } from '@ali/ide-editor/lib/browser';
import { ImagePreview } from './preview.view';
import { BinaryEditorComponent } from './external.view';
import { FILE_SCHEME, FILE_ON_DISK_SCHEME } from '../common';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileChangeType } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';

const IMAGE_PREVIEW_COMPONENT_ID = 'image-preview';
const EXTERNAL_OPEN_COMPONENT_ID = 'external-file';

@Injectable()
export class FileSystemResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = FILE_SCHEME;

  @Autowired()
  labelService: LabelService;

  @Autowired()
  fileServiceClient: FileServiceClient;

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
    return Promise.all([this.fileServiceClient.getFileStat(uri.toString()), this.labelService.getName(uri), this.labelService.getIcon(uri)]).then(([stat, name, icon]) => {
      console.log(stat);
      return {
        name: stat ? name : (name + localize('file.resource-deleted', '(已删除)')),
        icon,
        uri,
        metadata: null,
      };
    });
  }

  provideResourceSubname(uri: URI, group: URI[]): MaybePromise<string | null> {
    throw new Error('Method not implemented.');
  }

}

// TODO more reliable method
function isImage(uri: URI) {
  const extension = getExtension(uri);
  return ['.png', '.gif', '.jpg', '.jpeg', '.svg'].indexOf(extension.toLowerCase()) !== -1;
}

// TODO more reliable method
function isText(uri: URI) {
  const extension = getExtension(uri);
  return ['.js', '.ts', '.css', '.html', '.json', '.xml'].indexOf(extension.toLowerCase()) !== -1;
}

function getExtension(uri: URI): string {
  return uri.path.ext;
}

@Domain(BrowserEditorContribution)
export class FileSystemEditorContribution implements BrowserEditorContribution {

  @Autowired()
  fileSystemResourceProvider: FileSystemResourceProvider;

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.fileSystemResourceProvider);

  }

  registerComponent(editorComponentRegistry: EditorComponentRegistry) {
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
    editorComponentRegistry.registerEditorComponentResolver(FILE_SCHEME, (resource: IResource<any>, results: IEditorOpenType[]) => {
      if (isImage(resource.uri)) {
        results.push({
          type: 'component',
          componentId: IMAGE_PREVIEW_COMPONENT_ID,
        });
      }
    });

    // 文字文件
    editorComponentRegistry.registerEditorComponentResolver(FILE_SCHEME, (resource: IResource<any>, results: IEditorOpenType[]) => {
      if (isText(resource.uri)) {
        results.push({
          type: 'code',
        });
      }
    });

  }
}
