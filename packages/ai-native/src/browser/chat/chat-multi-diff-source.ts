import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, Event, URI, path } from '@opensumi/ide-core-browser';
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

const getResourceUri = (filePath: string, id: string, side: 'left' | 'right') =>
  URI.from({
    scheme: BaseApplyService.CHAT_EDITING_SOURCE_RESOLVER_SCHEME,
    path: filePath,
    query: URI.stringifyQuery({ id, side }),
  });

export class ChatMultiDiffSource implements IResolvedMultiDiffSource {
  constructor(private readonly baseApplyService: BaseApplyService, private readonly appConfig: AppConfig) {}

  readonly resources: IValueWithChangeEvent<readonly MultiDiffEditorItem[]> = (() => {
    const applyService = this.baseApplyService;
    const appConfig = this.appConfig;
    return {
      get value(): readonly MultiDiffEditorItem[] {
        return (applyService.getSessionCodeBlocks() || [])
          .filter((block) => block.status === 'success' || block.status === 'pending')
          .reduce(
            (acc, cur) => {
              const existingFile = acc.find((item) => item.relativePath === cur.relativePath);
              if (existingFile) {
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
            const filePath = path.join(appConfig.workspaceDir, block.relativePath);
            return new MultiDiffEditorItem(
              getResourceUri(filePath, block.oldBlockId, 'left'),
              getResourceUri(filePath, block.newBlockId, 'right'),
              URI.file(filePath),
            );
          });
      },
      // 这里event类型错误不影响
      onDidChange: this.baseApplyService.onCodeBlockUpdate as unknown as Event<void>,
    };
  })();
}
