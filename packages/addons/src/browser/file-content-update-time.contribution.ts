import { Injectable, Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { PreferenceSchema, PreferenceSchemaProvider, PreferenceService } from '@opensumi/ide-core-browser';
import { debounce, IReporterService, StaleLRUMap, OnEvent, URI, WithEventBus } from '@opensumi/ide-core-common';
import { EditorDocumentModelSavedEvent, EditorDocumentModelWillSaveEvent } from '@opensumi/ide-editor/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import {
  FileOperation,
  WorkspaceFileEvent,
  IWorkspaceFileOperationParticipant,
  IWorkspaceFileService,
} from '@opensumi/ide-workspace-edit';

enum ContentUpdateOperation {
  /**
   * 文本内容更新
   */
  Update = -100,
}

type FileAndContentOperation = FileOperation | ContentUpdateOperation;

interface FileChangeMarker {
  /**
   * 开始的时间戳
   */
  start: number;
  /**
   * 标记操作种类
   */
  operation: FileAndContentOperation;
}

enum FileOperationResultEnum {
  SUCCESS = 'success',
  FAIL = 'fail',
}

const FileOperationMsgMapStr = {
  [ContentUpdateOperation.Update]: 'update',
  [FileOperation.COPY]: 'copy',
  [FileOperation.CREATE]: 'create',
  [FileOperation.DELETE]: 'delete',
  [FileOperation.MOVE]: 'move',
};

const TRACE_LOG_FLAG = 'trace.file-content.update.time';

const configurationSchema: PreferenceSchema = {
  title: 'Addons',
  properties: {
    [TRACE_LOG_FLAG]: {
      type: 'boolean',
      default: false,
      description: 'flag for tracing file/content update time consuming',
    },
  },
};

/**
 * 本模块默认不加载，集成侧需要自定引入
 * 监听文件及内容变更的耗时
 *  命中条件：
 *    * file 类型文件
 *    * 在当前项目的 workspace root 下的文件
 *    * 打开了 trace log 配置 (具体字段见 `TRACE_LOG_FLAG`)
 *  记录的文件操作类型:
 *    * 文件的创建/删除/复制/移动
 *    * 文件内容变更 (增加 debounce 500ms 避免自动保存/批量替换/LSP重命名 触发的大量变更导致上报数量过多)
 *  记录的字段:
 *    * name: `FileAndContentOperation`
 *    * msg: 文件操作的类型
 *    * extra.uri: 文件 uri string
 *    * extra.time: 耗时
 *    * extra.result: 0 为成功 1 为失败
 *  其他备注:
 *    * time 的实际意义:
 *        - 记录了文件操作的从 js 代码开始执行到创建成功后前端可以收到通知的过程时长
 *        - 但是不涵盖异步事件通知文件树进行节点变幻到前端渲染完成的耗时部分
 *        - 当然对于文件内容更新的操作，这个时间就是完整的时间
 */
@Injectable()
@Domain(ClientAppContribution)
export class FileAndContentUpdateTimeContribution extends WithEventBus {
  @Autowired(IWorkspaceFileService)
  private readonly workspaceFileService: IWorkspaceFileService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IReporterService)
  private readonly reporterService: IReporterService;

  @Autowired(PreferenceSchemaProvider)
  private readonly preferenceSchemaProvider: PreferenceSchemaProvider;

  private _traceConfig = false;

  private _markedFileUris = new StaleLRUMap<string, FileChangeMarker>(100, 50, 10 * 60 * 1000 /* 十分钟超时清理 */);

  constructor() {
    super();
  }

  onDidStart() {
    // Set configuration schema
    this.preferenceSchemaProvider.setSchema(configurationSchema);
    // Do somethings when file operation is happening
    this._participateFileOperation();
    // Init listener for showPreview
    this._initTraceConfig();
  }

  // 增加一个 debounce 避免 editor.autoSave 导致频繁变更触发
  // 只监听 file 协议
  @debounce(500)
  @OnEvent(EditorDocumentModelWillSaveEvent)
  public handleEditorDocModelWillSave(e: EditorDocumentModelWillSaveEvent) {
    const { uri } = e.payload;
    // 手动保存的立刻上报
    // 标记文件链接
    this._markFileUri(uri, ContentUpdateOperation.Update);
  }

  @debounce(500)
  @OnEvent(EditorDocumentModelSavedEvent)
  public handleEditorDocModelDidSave(e: EditorDocumentModelSavedEvent) {
    const uri = e.payload;
    this._reportFileOperation(uri, ContentUpdateOperation.Update, FileOperationResultEnum.SUCCESS);
  }

  private _participateFileOperation() {
    // BEFORE file operation
    this.addDispose(
      this.workspaceFileService.registerFileOperationParticipant({
        participate: this.fileOperationParticipant.bind(this),
      }),
    );

    // AFTER file operation SUCCEED
    this.addDispose(
      this.workspaceFileService.onDidRunWorkspaceFileOperation(this._handleFileOperationDidRun.bind(this)),
    );

    // AFTER file operation FAILED
    this.addDispose(
      this.workspaceFileService.onDidFailWorkspaceFileOperation(this._handleFileOperationDidFail.bind(this)),
    );
  }

  private async fileOperationParticipant(...args: Parameters<IWorkspaceFileOperationParticipant['participate']>) {
    const [files, operation] = args;
    for (const file of files) {
      this._markFileUri(new URI(file.target), operation);
    }
  }

  /**
   * refactoring changes 带来的文件增删也会带进来，但是一般来说比较少见
   * 出于性能考虑，删除文件的设计是异步操作的，因此删除文件可能耗时比肉眼可见的要长一些
   */
  private _handleFileOperationDidRun(e: WorkspaceFileEvent) {
    const { files, operation } = e;
    for (const file of files) {
      this._reportFileOperation(new URI(file.target), operation, FileOperationResultEnum.SUCCESS);
    }
  }

  private _handleFileOperationDidFail(e: WorkspaceFileEvent) {
    const { files, operation } = e;
    for (const file of files) {
      this._reportFileOperation(new URI(file.target), operation, FileOperationResultEnum.FAIL);
    }
  }

  private async _markFileUri(uri: URI, operation: FileAndContentOperation) {
    const shouldReport = await this._shouldReport(uri);
    if (!shouldReport) {
      return;
    }

    const uriStr = uri.toString(true);
    this._markedFileUris.set(uriStr, {
      start: Date.now(),
      operation,
    });
  }

  private async _reportFileOperation(uri: URI, operation: FileAndContentOperation, result: FileOperationResultEnum) {
    const shouldReport = await this._shouldReport(uri);
    if (!shouldReport) {
      return;
    }

    const uriStr = uri.toString(true);
    const existedMarker = this._markedFileUris.get(uriStr);
    // 不存在标记 | 标记的行为不匹配的 均过滤掉
    if (!existedMarker || existedMarker.operation !== operation) {
      return;
    }
    // report here
    this.reporterService.point(
      'FileAndContentOperation',
      FileOperationMsgMapStr[existedMarker.operation] || 'unknown',
      {
        uri: uriStr,
        time: Date.now() - existedMarker.start,
        result: result === FileOperationResultEnum.SUCCESS ? 0 : 1,
      },
    );
    // delete cached
    this._markedFileUris.delete(uriStr);
  }

  private _initTraceConfig() {
    // additional edits for file-participants
    this._traceConfig = !!this.preferenceService.get<boolean>(TRACE_LOG_FLAG);
    this.addDispose(
      this.preferenceService.onPreferenceChanged((e) => {
        if (e.preferenceName === TRACE_LOG_FLAG) {
          this._traceConfig = !!e.newValue;
        }
      }),
    );
  }

  /**
   * 不符合要求的文件直接跳过
   */
  private async _shouldReport(uri: URI): Promise<boolean> {
    // 配置项关闭则直接跳过记录
    if (!this._traceConfig) {
      return false;
    }

    // 非当前 workspace 的文件不统计 | 非 file 协议不统计
    if (uri.scheme !== 'file') {
      return false;
    }

    // 文件是当前 workspace 下的
    const roots = await this.workspaceService.roots;
    return roots.some((fileStat) => !!new URI(fileStat.uri).relative(uri));
  }
}
