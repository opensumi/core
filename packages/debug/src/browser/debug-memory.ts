import { Injectable, Autowired } from '@opensumi/di';
import {
  Event,
  FileSystemProvider,
  FileChangeEvent,
  FileStat,
  FileSystemProviderCapabilities,
  FileType,
  Uri,
  BinaryBuffer,
  Emitter,
} from '@opensumi/ide-core-common';

import { DEBUG_MEMORY_SCHEME, IDebugSessionManager } from '../common';

import { DebugSessionManager } from '.';

@Injectable()
export class DebugMemoryFileSystemProvider implements FileSystemProvider {
  @Autowired(IDebugSessionManager)
  protected readonly debugSessionManager: DebugSessionManager;

  private readonly changeEmitter = new Emitter<FileChangeEvent>();

  public readonly capabilities: FileSystemProviderCapabilities =
    0 | FileSystemProviderCapabilities.PathCaseSensitive | FileSystemProviderCapabilities.FileOpenReadWriteClose;

  public readonly onDidChangeCapabilities = Event.None;

  public onDidChangeFile: Event<FileChangeEvent> = this.changeEmitter.event;

  public stat(uri: Uri): Promise<void | FileStat> {
    return Promise.resolve({
      type: FileType.File,
      uri: uri.toString(),
      mtime: 0,
      ctime: 0,
      size: 0,
      lastModification: 0,
      isDirectory: false,
    });
  }

  public readFile(uri: Uri): void | Uint8Array | Promise<void | Uint8Array> {
    const parse = this.parseUri(uri);
    if (parse && !parse.offset) {
      return;
    }

    return this.toBuffer('');
  }

  private toBuffer(s: string): Uint8Array {
    return BinaryBuffer.fromString(s).buffer;
  }

  private parseUri(uri: Uri) {
    if (uri.scheme !== DEBUG_MEMORY_SCHEME) {
      return;
    }

    const session = this.debugSessionManager.sessions.find((s) => s.id.toLowerCase() === uri.authority.toLowerCase());
    if (!session) {
      return;
    }

    let offset: { fromOffset: number; toOffset: number } | undefined;
    /**
     * query 参数是 hex-editor 插件通过覆盖了 debug file accessor 处理过后添加上的，形如
     * ?range=0:131072
     */
    const rangeMatch = /range=([0-9]+):([0-9]+)/.exec(uri.query);
    if (rangeMatch) {
      offset = { fromOffset: Number(rangeMatch[1]), toOffset: Number(rangeMatch[2]) };
    }

    const [, memoryReference] = uri.path.split('/');

    return {
      session,
      offset,
      readOnly: !session.capabilities.supportsWriteMemoryRequest,
      sessionId: uri.authority,
      memoryReference: decodeURIComponent(memoryReference),
    };
  }

  public readDirectory(): never {
    throw new Error('Not allowed');
  }

  public createDirectory(): never {
    throw new Error('Not allowed');
  }

  public rename(): never {
    throw new Error('Not allowed');
  }

  public delete(): never {
    throw new Error('Not allowed');
  }

  public watch(): never {
    throw new Error('Not allowed');
  }

  /**
   * 目前仅支持读，不支持写
   */
  public writeFile(): never {
    throw new Error('Method not implemented.');
  }
}
