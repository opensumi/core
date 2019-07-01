import * as md5 from 'md5';
import { Emitter as EventEmitter, URI, Event } from '@ali/ide-core-common';
import { FileService } from '@ali/ide-file-service';
import { Autowired, Injectable } from '@ali/common-di';
import { FileChangeType } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { IRawFileReference, IRawFileReferenceManager, IRawFileWatchService } from '../common/raw-file';
import { Version, VersionType } from '../common';

export class RawFileReference implements IRawFileReference {
  private _uri: URI;
  private _version: Version;
  private _service: RawFileVersionService;
  private _md5: string;

  constructor(
    uri: string | URI,
    md5: string,
    service: RawFileVersionService,
  ) {
    this._service = service;
    this._uri = new URI(uri.toString());
    this._md5 = md5;
    this._version = this._service.create(this._uri);
  }

  get uri() {
    return this._uri;
  }

  get version() {
    return this._version;
  }

  get md5() {
    return this._md5;
  }

  updateValue(md5: string) {
    this._md5 = md5;
  }

  nextVersion() {
    this._version = this._service.next(this._uri);
    return this;
  }
}

@Injectable()
export class RawFileReferenceManager implements IRawFileReferenceManager {
  @Autowired()
  private fileService: FileService;

  private service: RawFileVersionService = new RawFileVersionService();
  private references: Map<string, RawFileReference> = new Map();

  async resolveReference(uri: string | URI) {
    let ref = this.references.get(uri.toString());

    if (!ref) {
      ref = await this.initReference(uri);
    }

    return ref;
  }

  async initReference(uri: string | URI) {
    const res = await this.fileService.resolveContent(uri.toString());
    const md5Value = md5(res.content);
    const ref = new RawFileReference(uri, md5Value, this.service);
    this.references.set(uri.toString(), ref);
    return ref;
  }

  removeReference(uri: string | URI) {
    this.references.delete(uri.toString());
    this.service.delete(uri.toString());
  }
}

@Injectable()
export class RawFileWatchService implements IRawFileWatchService {
  @Autowired()
  private fileService: FileService;
  @Autowired()
  private manager: RawFileReferenceManager;

  private _uri2id = new Map<string, number>();

  private _onChanged = new EventEmitter<IRawFileReference>();
  private _onCreated = new EventEmitter<IRawFileReference>();
  private _onRemoved = new EventEmitter<IRawFileReference>();

  public onChanged: Event<IRawFileReference> = this._onChanged.event;
  public onCreated: Event<IRawFileReference> = this._onCreated.event;
  public onRemoved: Event<IRawFileReference> = this._onRemoved.event;

  constructor() {
    this.fileService.onFilesChanged(async (event) => {
      const { changes } = event as any;
      for (const change of changes) {
        const { uri, type } = change as { uri: URI, type: FileChangeType };
        const ref = await this.manager.resolveReference(uri);
        const md5Value = await this.calculateMD5(uri);
        switch (type) {
          case FileChangeType.UPDATED:
            if (ref.md5 !== md5Value) {
              ref.nextVersion();
              ref.updateValue(md5Value);
              this._onChanged.fire(ref);
            }
            break;
          case FileChangeType.DELETED:
            this._onRemoved.fire(ref);
            break;
          default:
            break;
        }
      }
    });
  }

  async calculateMD5(uri: string | URI, encoding = 'utf-8'): Promise<string> {
    const res = await this.fileService.resolveContent(uri.toString(), { encoding });
    return md5(res.content);
  }

  async watch(uri: string | URI) {
    let id = this._uri2id.get(uri.toString());

    if (!id) {
      id = await this.fileService.watchFileChanges(uri.toString());
      this._uri2id.set(uri.toString(), id);
    }
  }

  async unwatch(uri: string | URI) {
    const id = this._uri2id.get(uri.toString());

    if (id) {
      return this.fileService.unwatchFileChanges(id);
    }
  }
}

export class RawFileVersionService {
  private _versions: Map<string, Version> = new Map();

  create(uri: string | URI) {
    const version = Version.init(VersionType.raw);
    this._versions.set(uri.toString(), version);
    return version;
  }

  delete(uri: string | URI) {
    this._versions.delete(uri.toString());
  }

  next(uri: string | URI) {
    let version = this._versions.get(uri.toString());

    if (!version) {
      throw new Error('Version not exists');
    }

    version = Version.next(version);
    this._versions.set(uri.toString(), version);
    return version;
  }
}
