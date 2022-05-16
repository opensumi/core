import { clamp } from 'lodash';

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
  Disposable,
  ILogger,
} from '@opensumi/ide-core-common';

import {
  DEBUG_MEMORY_SCHEME,
  IDebugSession,
  IDebugSessionManager,
  IMemoryInvalidationEvent,
  IMemoryRegion,
  MemoryRange,
  MemoryRangeType,
} from '../common';

import { DebugSessionManager } from '.';

@Injectable()
export class DebugMemoryFileSystemProvider implements FileSystemProvider {
  @Autowired(IDebugSessionManager)
  protected readonly debugSessionManager: DebugSessionManager;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private memoryFdCounter = 0;
  private readonly changeEmitter = new Emitter<FileChangeEvent>();
  private readonly fdMemory = new Map<number, { session: IDebugSession; region: IMemoryRegion }>();

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

  public async readFile(uri: Uri): Promise<void | Uint8Array> {
    const parse = this.parseUri(uri);
    if (!parse) {return this.toBuffer('');}

    if (!parse.offset) {return this.toBuffer('');}

    const { session, memoryReference, offset } = parse;

    const data = new Uint8Array(offset.toOffset - offset.fromOffset);

    const fd = this.memoryFdCounter++;
    let region = session.getMemory(memoryReference);
    if (offset) {
      region = new MemoryRegionView(region, offset);
    }

    this.fdMemory.set(fd, { session, region });
    await this.read(fd, offset.fromOffset, data, 0, data.length);
    return data;
  }

  public async read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number | void> {
    const memory = this.fdMemory.get(fd);
    if (!memory) {
      return;
    }

    const ranges = await memory.region.read(pos, length);
    let readSoFar = 0;
    for (const range of ranges) {
      switch (range.type) {
        case MemoryRangeType.Unreadable:
          return readSoFar;
        case MemoryRangeType.Error:
          if (readSoFar > 0) {
            return readSoFar;
          } else {
            return this.logger.error(range.error);
          }
        case MemoryRangeType.Valid: {
          const start = Math.max(0, pos - range.offset);
          const toWrite = range.data.slice(start, Math.min(range.data.byteLength, start + (length - readSoFar)));
          data.set(toWrite.buffer, offset + readSoFar);
          readSoFar += toWrite.byteLength;
          break;
        }
        default:
          this.logger.log(range);
      }
    }

    return readSoFar;
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

class MemoryRegionView extends Disposable implements IMemoryRegion {
  private readonly invalidateEmitter = new Emitter<IMemoryInvalidationEvent>();

  public readonly onDidInvalidate = this.invalidateEmitter.event;
  public readonly writable: boolean;
  private readonly width = this.range.toOffset - this.range.fromOffset;

  constructor(private readonly parent: IMemoryRegion, public readonly range: { fromOffset: number; toOffset: number }) {
    super();
    this.writable = parent.writable;

    this.registerDispose(parent);
    this.registerDispose(
      parent.onDidInvalidate((e) => {
        const fromOffset = clamp(e.fromOffset - range.fromOffset, 0, this.width);
        const toOffset = clamp(e.toOffset - range.fromOffset, 0, this.width);
        if (toOffset > fromOffset) {
          this.invalidateEmitter.fire({ fromOffset, toOffset });
        }
      }),
    );
  }

  public read(fromOffset: number, toOffset: number): Promise<MemoryRange[]> {
    if (fromOffset < 0) {
      throw new RangeError(`Invalid fromOffset: ${fromOffset}`);
    }

    return this.parent.read(this.range.fromOffset + fromOffset, this.range.fromOffset + Math.min(toOffset, this.width));
  }

  public write(offset: number, data: BinaryBuffer): Promise<number> {
    return this.parent.write(this.range.fromOffset + offset, data);
  }
}
