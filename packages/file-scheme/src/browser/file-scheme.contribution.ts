import { Autowired } from '@opensumi/di';
import { Domain, LRUMap, PreferenceService, Schemes, URI, localize } from '@opensumi/ide-core-browser';
import { getLanguageIdFromMonaco } from '@opensumi/ide-core-browser/lib/services';
import { IEditorOpenType, IResource, ResourceService } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorOpenType,
  IEditorDocumentModelContentRegistry,
} from '@opensumi/ide-editor/lib/browser';
import {
  UntitledSchemeDocumentProvider,
  UntitledSchemeResourceProvider,
} from '@opensumi/ide-editor/lib/browser/untitled-resource';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import { BinaryEditorComponent } from './external.view';
import {
  FileSchemeDocumentProvider,
  VscodeSchemeDocumentProvider,
  WalkThroughSnippetSchemeDocumentProvider,
} from './file-doc';
import { LargeFilePrevent } from './prevent.view';
import { ImagePreview, VideoPreview } from './preview.view';

const VIDEO_PREVIEW_COMPONENT_ID = 'video-preview';
const IMAGE_PREVIEW_COMPONENT_ID = 'image-preview';
const EXTERNAL_OPEN_COMPONENT_ID = 'external-file';
const LARGE_FILE_PREVENT_COMPONENT_ID = 'large-file-prevent';

@Domain(BrowserEditorContribution)
export class FileSystemEditorResourceContribution implements BrowserEditorContribution {
  @Autowired()
  private readonly fileSchemeDocumentProvider: FileSchemeDocumentProvider;

  @Autowired()
  private readonly vscodeSchemeDocumentProvider: VscodeSchemeDocumentProvider;

  @Autowired()
  private readonly walkThroughSnippetSchemeDocumentProvider: WalkThroughSnippetSchemeDocumentProvider;

  @Autowired()
  private readonly untitledResourceProvider: UntitledSchemeResourceProvider;

  @Autowired()
  private readonly untitledSchemeDocumentProvider: UntitledSchemeDocumentProvider;

  registerResource(resourceService: ResourceService) {
    // 注册 provider 处理 file scheme 对应的 icon/meta 等信息
    resourceService.registerResourceProvider(this.untitledResourceProvider);
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    // 注册 provider 提供 doc / 文档的内容和 meta 信息
    registry.registerEditorDocumentModelContentProvider(this.fileSchemeDocumentProvider);
    registry.registerEditorDocumentModelContentProvider(this.vscodeSchemeDocumentProvider);
    registry.registerEditorDocumentModelContentProvider(this.walkThroughSnippetSchemeDocumentProvider);
    registry.registerEditorDocumentModelContentProvider(this.untitledSchemeDocumentProvider);
  }
}

@Domain(BrowserEditorContribution)
export class FileSystemEditorComponentContribution implements BrowserEditorContribution {
  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(PreferenceService)
  private readonly preference: PreferenceService;

  private cachedFileType = new LRUMap<string, string | undefined>(200, 100);

  constructor() {
    this.fileServiceClient.onFilesChanged((e) => {
      e.forEach((change) => {
        this.cachedFileType.delete(change.uri.toString());
      });
    });
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    editorComponentRegistry.registerEditorComponent({
      component: ImagePreview,
      uid: IMAGE_PREVIEW_COMPONENT_ID,
      scheme: Schemes.file,
    });

    editorComponentRegistry.registerEditorComponent({
      component: VideoPreview,
      uid: VIDEO_PREVIEW_COMPONENT_ID,
      scheme: Schemes.file,
    });

    editorComponentRegistry.registerEditorComponent({
      component: BinaryEditorComponent,
      uid: EXTERNAL_OPEN_COMPONENT_ID,
      scheme: Schemes.file,
    });

    editorComponentRegistry.registerEditorComponent({
      component: LargeFilePrevent,
      uid: LARGE_FILE_PREVENT_COMPONENT_ID,
      scheme: Schemes.file,
    });

    // 如果文件无法在当前IDE编辑器中找到打开方式
    editorComponentRegistry.registerEditorComponentResolver(
      (scheme: string) => (scheme === Schemes.file || this.fileServiceClient.handlesScheme(scheme) ? 10 : -1),
      (resource: IResource<any>, results: IEditorOpenType[]) => {
        if (results.length === 0) {
          results.push({
            type: EditorOpenType.component,
            componentId: EXTERNAL_OPEN_COMPONENT_ID,
          });
        }
      },
    );

    editorComponentRegistry.registerEditorComponentResolver(
      (scheme: string) => (scheme === Schemes.file || this.fileServiceClient.handlesScheme(scheme) ? 10 : -1),
      async (resource: IResource<any>, results: IEditorOpenType[]) => {
        const type = await this.getFileType(resource.uri.toString());

        switch (type) {
          case 'image': {
            results.push({
              type: EditorOpenType.component,
              componentId: IMAGE_PREVIEW_COMPONENT_ID,
            });
            break;
          }
          case 'video': {
            results.push({
              type: EditorOpenType.component,
              componentId: VIDEO_PREVIEW_COMPONENT_ID,
            });
            break;
          }
          case 'binary':
          case 'text': {
            const { metadata: _metadata, uri } = resource;
            const metadata = _metadata || {};

            // 二进制文件不支持打开
            if (type === 'binary' && !metadata.skipPreventBinary) {
              break;
            }

            const stat = await this.fileServiceClient.getFileStat(uri.toString());
            await this.preference.ready;
            const maxSize = this.preference.getValid<number>('editor.largeFile', 4 * 1024 * 1024 * 1024);

            if (stat && (stat.size || 0) > maxSize && !metadata.skipPreventTooLarge) {
              results.push({
                type: EditorOpenType.component,
                componentId: LARGE_FILE_PREVENT_COMPONENT_ID,
              });
            } else {
              results.push({
                type: EditorOpenType.code,
                title: localize('editorOpenType.code'),
              });
            }
            break;
          }
        }
      },
    );

    // untitled 文件仅支持 code type
    editorComponentRegistry.registerEditorComponentResolver(
      Schemes.untitled,
      (_resource: IResource<any>, _results: IEditorOpenType[], resolve: (results: IEditorOpenType[]) => void) => {
        resolve([
          {
            type: EditorOpenType.code,
            priority: 'default',
          },
        ]);
      },
    );
  }

  private async getFileType(uri: string): Promise<string | undefined> {
    if (!this.cachedFileType.has(uri)) {
      if (getLanguageIdFromMonaco(new URI(uri))) {
        // 对于已知 language 对应扩展名的文件，当 text 处理
        this.cachedFileType.set(uri, 'text');
      } else {
        this.cachedFileType.set(uri, await this.getRealFileType(uri));
      }
    }
    return this.cachedFileType.get(uri);
  }

  private async getRealFileType(uri: string) {
    try {
      return await this.fileServiceClient.getFileType(uri);
    } catch (err) {
      // 沿用之前设计，继续使用 `text` 作为返回值
      return 'text';
    }
  }
}
