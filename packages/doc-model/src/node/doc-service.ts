// @ts-ignore
import * as detect from 'language-detect';
import { extname } from 'path';
import { URI } from '@ali/ide-core-common';
import { RPCService } from '@ali/ide-connection';
import { Autowired, Injectable } from '@ali/common-di';
import { FileService } from '@ali/ide-file-service';
import { RawFileReferenceManager, RawFileWatchService } from './raw-file';
import { IDocumentModelMirror, Version, INodeDocumentService } from '../common';

export const staticConfig = {
  eol: '/n',
};

function filename2Language(filename: string) {
  const ext = extname(filename);
  switch (ext) {
    case '.tsx':
    case '.ts':
      return 'typescript';
    default:
      return detect.filename(filename).toLowerCase(); // TODO use languages service
  }
}

@Injectable()
export class NodeDocumentService extends RPCService implements INodeDocumentService {
  @Autowired()
  private fileService: FileService;
  @Autowired()
  private watchService: RawFileWatchService;
  @Autowired()
  private refManager: RawFileReferenceManager;

  constructor() {
    super();

    this.watchService.onChanged(async (ref) => {
      const { uri } = ref;
      const mirror = await this.resolve(uri.toString());
      if (this.rpcClient) {
        this.rpcClient.forEach((client) => {
          client.updateContent(mirror);
        });
      }
    });

    this.watchService.onRemoved((ref) => {
      const { uri } = ref;
      this.watchService.unwatch(uri);
      this.refManager.removeReference(uri);
    });
  }

  async resolve(uri: string): Promise<IDocumentModelMirror> {
    const ref = this.refManager.getReference(uri);
    const encoding = await this.fileService.getEncoding(uri);
    const { content } = await this.fileService.resolveContent(uri);
    const lines = content.split(staticConfig.eol);
    const language = filename2Language(uri);

    this.watchService.watch(uri);

    return {
      uri, lines, encoding, language,
      eol: staticConfig.eol,
      base: ref.version.toJSON(),
    };
  }

  private async _saveFile(uri: URI, content: string, encoding: string) {
    const stat = await this.fileService.getFileStat(uri.toString());

    if (!stat) {
      throw new Error('Save file failed');
    }

    return this.fileService.setContent(stat, content, { encoding });
  }

  async persist(mirror: IDocumentModelMirror, override?: boolean) {
    const { uri, base, encoding, lines, eol } = mirror;
    const ref = this.refManager.getReference(uri);

    if (override) {
      /**
       * 合并操作已经在前台完成，
       * 我们在后台生成一个新的基版本并返回给前台。
       */
      const content = lines.join(eol);
      const stat = await this._saveFile(ref.uri, content, encoding);
      if (stat) {
        // 生成一个新的基版本
        ref.nextVersion();
        const mirror = await this.resolve(uri);
        return mirror;
      }
    } else if (Version.equal(ref.version, base)) {
      /**
       * 线上文档和本地文件的基版本相同，
       * 不需要进行合并操作，直接保存到本地。
       */
      const content = lines.join(eol);
      const stat = await this._saveFile(ref.uri, content, encoding);
      if (stat) {
        return mirror;
      }
    } else {
      /**
       * 线上文档和本地的基版本不相同，
       * 需要一个合并操作，我们生成一个本地的 mirror 给前台，
       * 交给前台判断接下来的操作。
       */
      const mirror = await this.resolve(uri);
      return mirror;
    }

    return null;
  }
}
