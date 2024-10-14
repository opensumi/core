import { Autowired, Injectable } from '@opensumi/di';
import {
  Emitter,
  EncodingRegistry,
  Event,
  FileChangeType,
  IApplicationService,
  IEditorDocumentChange,
  IEditorDocumentModelSaveResult,
  OperatingSystem,
  PreferenceService,
  SaveTaskResponseState,
  URI,
  UTF8,
  UTF8_with_bom,
  detectEncodingFromBuffer,
  getLanguageIdFromMonaco,
} from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { EOL } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { IEditorDocumentModelContentProvider } from '../doc-model/types';
import { EditorPreferences } from '../preference/schema';

export interface ReadEncodingOptions {
  /**
   * The optional encoding parameter allows to specify the desired encoding when resolving
   * the contents of the file.
   */
  encoding?: string;

  /**
   * The optional guessEncoding parameter allows to guess encoding from content of the file.
   */
  autoGuessEncoding?: boolean;
}

/**
 * 通用的用来处理 FileSystem 提供的文档
 * 可以 extend 这个来添加更强的能力，如 file-scheme 中的 file-doc
 */
@Injectable()
export class BaseFileSystemEditorDocumentProvider implements IEditorDocumentModelContentProvider {
  protected _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  protected _fileContentMd5OnBrowserFs: Set<string> = new Set();

  private _detectedEncodingMap = new Map<string, string>();
  private _detectedEolMap = new Map<string, EOL>();

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(EditorPreferences)
  protected readonly editorPreferences: EditorPreferences;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(EncodingRegistry)
  encodingRegistry: EncodingRegistry;

  constructor() {
    this.fileServiceClient.onFilesChanged((changes) => {
      changes.forEach((change) => {
        if (this._fileContentMd5OnBrowserFs.has(change.uri)) {
          if (change.type === FileChangeType.ADDED || change.type === FileChangeType.UPDATED) {
            this._onDidChangeContent.fire(new URI(change.uri));
          }
        }
      });
    });
  }

  handlesScheme(scheme: string) {
    return this.fileServiceClient.handlesScheme(scheme);
  }

  provideEncoding(uri: URI) {
    return this._detectedEncodingMap.get(uri.toString()) || UTF8;
  }

  async provideEOL(uri: URI) {
    const cache = this._detectedEolMap.get(uri.toString());
    if (cache) {
      return cache;
    }
    const backendOS = await this.applicationService.getBackendOS();
    return backendOS === OperatingSystem.Windows ? EOL.CRLF : EOL.LF;
  }

  async read(uri: URI, options: ReadEncodingOptions): Promise<{ encoding: string; content: string; eol: EOL }> {
    const { content: buffer } = await this.fileServiceClient.readFile(uri.toString());

    const guessEncoding =
      options.autoGuessEncoding ||
      this.preferenceService.get<boolean>(
        'files.autoGuessEncoding',
        undefined,
        uri.toString(),
        getLanguageIdFromMonaco(uri)!,
      );

    // TODO: 应该挪到后端去做
    const detected = await detectEncodingFromBuffer(buffer, guessEncoding);

    detected.encoding = await this.getReadEncoding(uri, options, detected.encoding);

    const content = buffer.toString(detected.encoding);

    const eol = await this.getEol(uri, content);
    const uriString = uri.toString();

    this._detectedEncodingMap.set(uriString, detected.encoding);
    this._detectedEolMap.set(uriString, eol);

    // 记录表示这个文档被引用了
    this._fileContentMd5OnBrowserFs.add(uriString);

    return {
      encoding: detected.encoding || UTF8,
      content,
      eol,
    };
  }

  private async getEol(uri: URI, content: string) {
    const MAX_DETECT_LENGTH = 2000;
    let cr = 0;
    let lf = 0;
    let crlf = 0;
    const len = Math.min(MAX_DETECT_LENGTH, content.length);
    for (let i = 0; i < len; i++) {
      if (content[i] === '\r') {
        if (content[i + 1] === '\n') {
          crlf++;
          // 跳过后续 \n
          i++;
        } else {
          cr++;
        }
      } else if (content[i] === '\n') {
        lf++;
      }
    }

    const totalEOLCount = cr + lf + crlf;
    const totalCRCount = cr + crlf;
    const eol = this.preferenceService.get<EOL | 'auto'>(
      'files.eol',
      'auto',
      uri.toString(),
      getLanguageIdFromMonaco(uri)!,
    )!;
    if (eol !== 'auto') {
      return eol;
    }
    const defaultEOL = await this.provideEOL(uri);
    if (totalEOLCount === 0) {
      return defaultEOL;
    }
    if (totalCRCount > totalEOLCount / 2) {
      return EOL.CRLF;
    }
    return EOL.LF;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding: string) {
    // TODO: 这部分要优化成buffer获取（长期来看是stream获取，encoding在哪一层做？）
    // 暂时还是使用 resolveContent 内提供的 decode 功能
    // 之后 encoding 做了分层之后和其他的需要 decode 的地方一起改

    return (await this.read(uri, { encoding })).content;
  }

  async isReadonly(uri: URI): Promise<boolean> {
    const readonlyFiles: string[] = this.editorPreferences['editor.readonlyFiles'];
    if (readonlyFiles && readonlyFiles.length) {
      for (const file of readonlyFiles) {
        if (
          uri.isEqual(URI.file(file)) ||
          uri.matchGlobPattern(file) ||
          uri.toString().endsWith(file.replace('./', ''))
        ) {
          return true;
        }
      }
    }
    return this.fileServiceClient.isReadonly(uri.toString());
  }

  async saveDocumentModel(
    uri: URI,
    content: string,
    baseContent: string,
    changes: IEditorDocumentChange[],
    encoding: string,
    ignoreDiff = false,
  ): Promise<IEditorDocumentModelSaveResult> {
    // 默认的文件系统都直接存 content
    try {
      const fileStat = await this.fileServiceClient.getFileStat(uri.toString());
      if (!fileStat) {
        await this.fileServiceClient.createFile(uri.toString(), { content, overwrite: true, encoding });
      } else {
        await this.fileServiceClient.setContent(fileStat, content, { encoding });
      }
      return {
        state: SaveTaskResponseState.SUCCESS,
      };
    } catch (e) {
      return {
        state: SaveTaskResponseState.ERROR,
        errorMessage: e.message,
      };
    }
  }

  onDidDisposeModel(uri: URI) {
    this._fileContentMd5OnBrowserFs.delete(uri.toString());
  }

  async guessEncoding(uri: URI) {
    return (await this.read(uri, { autoGuessEncoding: true })).encoding;
  }

  protected getReadEncoding(
    resource: URI,
    options: ReadEncodingOptions | undefined,
    detectedEncoding: string | null,
  ): Promise<string> {
    let preferredEncoding: string | undefined;

    // Encoding passed in as option
    if (options?.encoding) {
      if (detectedEncoding === UTF8_with_bom && options.encoding === UTF8) {
        preferredEncoding = UTF8_with_bom; // indicate the file has BOM if we are to resolve with UTF 8
      } else {
        preferredEncoding = options.encoding; // give passed in encoding highest priority
      }
    } else if (detectedEncoding) {
      preferredEncoding = detectedEncoding;
    }

    return this.getEncodingForResource(resource, preferredEncoding);
  }

  protected async getEncodingForResource(resource: URI, preferredEncoding?: string): Promise<string> {
    return this.encodingRegistry.getEncodingForResource(resource, preferredEncoding);
  }
}
