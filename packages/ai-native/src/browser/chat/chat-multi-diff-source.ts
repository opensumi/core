import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, URI, path } from '@opensumi/ide-core-browser';
import {
  IMultiDiffSourceResolver,
  IResolvedMultiDiffSource,
  MultiDiffEditorItem,
} from '@opensumi/ide-editor/lib/common/multi-diff';
import { IValueWithChangeEvent } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';

import { BaseApplyService } from '../mcp/base-apply.service';

@Injectable()
export class ChatMultiDiffResolver implements IMultiDiffSourceResolver {
  static readonly CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME = 'chat-editing-multi-diff-source';

  @Autowired(BaseApplyService)
  private readonly baseApplyService: BaseApplyService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  canHandleUri(uri: URI): boolean {
    return uri.scheme === ChatMultiDiffResolver.CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME;
  }

  resolveDiffSource(uri: URI): Promise<IResolvedMultiDiffSource> {
    return Promise.resolve(new ChatMultiDiffSource(this.baseApplyService, this.appConfig));
  }
}

export class ChatMultiDiffSource implements IResolvedMultiDiffSource {
  constructor(private readonly baseApplyService: BaseApplyService, private readonly appConfig: AppConfig) {}

  private getResourceUri(filePath: string, id: string, version: number) {
    return URI.from({
      scheme: BaseApplyService.CHAT_EDITING_SOURCE_RESOLVER_SCHEME,
      path: filePath,
      query: URI.stringifyQuery({ id, version }),
    });
  }

  readonly resources: IValueWithChangeEvent<readonly MultiDiffEditorItem[]> = {
    value: this.baseApplyService
      .getSessionCodeBlocks()
      .filter((block) => block.status !== 'failed')
      .reduce(
        (acc, cur) => {
          const existingFile = acc.find((item) => item.relativePath === cur.relativePath);
          if (existingFile) {
            // TODO: 简化算法，oldVersion 是 1，直接判断就行
            // Update versions and block IDs if needed
            if (cur.version < existingFile.oldVersion) {
              existingFile.oldVersion = cur.version;
              existingFile.oldBlockId = cur.toolCallId;
            }
            if (cur.version > existingFile.newVersion) {
              existingFile.newVersion = cur.version;
              existingFile.newBlockId = cur.toolCallId;
            }
          } else {
            // Add new file entry
            acc.push({
              relativePath: cur.relativePath,
              oldBlockId: cur.toolCallId,
              newBlockId: cur.toolCallId,
              oldVersion: cur.version,
              newVersion: cur.version,
            });
          }
          return acc;
        },
        [] as {
          relativePath: string;
          oldBlockId: string;
          newBlockId: string;
          oldVersion: number;
          newVersion: number;
        }[],
      )
      .map((block) => {
        const filePath = path.join(this.appConfig.workspaceDir, block.relativePath);
        return {
          originalUri: this.getResourceUri(filePath, block.oldBlockId, block.oldVersion),
          modifiedUri: this.getResourceUri(filePath, block.newBlockId, block.newVersion),
          goToFileUri: URI.file(filePath),
          getKey: () => block.relativePath,
          ...block,
        };
      }),
    // 这里event类型错误不影响
    // @ts-expect-error
    onDidChange: this.baseApplyService.onCodeBlockUpdate,
  };
}
