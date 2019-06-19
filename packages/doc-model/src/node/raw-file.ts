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

  constructor(
    uri: string | URI,
    service: RawFileVersionService,
  ) {
    this._service = service;
    this._uri = new URI(uri.toString());
    this._version = this._service.create(this._uri);
  }

  get uri() {
    return this._uri;
  }

  get version() {
    return this._version;
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

  getReference(uri: string | URI) {
    let ref = this.references.get(uri.toString());

    if (!ref) {
      ref = this.initReference(uri);
    }

    return ref;
  }

  initReference(uri: string | URI) {
    const ref = new RawFileReference(uri, this.service);
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
    this.fileService.onFilesChanged((event) => {
      const { changes } = event as any;
      for (const change of changes) {
        const { uri, type } = change as { uri: URI, type: FileChangeType };
        const ref = this.manager.getReference(uri);
        switch (type) {
          case FileChangeType.UPDATED:
            ref.nextVersion();
            this._onChanged.fire(ref);
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
