// @ts-ignore
import * as detect from 'language-detect';
import * as md5 from 'md5';
import { extname } from 'path';
import { URI } from '@ali/ide-core-common';
import { RPCService } from '@ali/ide-connection';
import { Autowired, Injectable } from '@ali/common-di';
import { IFileService } from '@ali/ide-file-service';
import { RawFileReferenceManager, RawFileWatchService } from './raw-file';
import { IDocumentModelMirror, Version, INodeDocumentService, VersionType, IDocumentModelStatMirror } from '../common';
import { applyChanges } from '../common/utils';

export const staticConfig = {
  eol: '\n',
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
  @Autowired(IFileService)
  private fileService: IFileService;
  @Autowired()
  private watchService: RawFileWatchService;
  @Autowired()
  private refManager: RawFileReferenceManager;

  constructor() {
    super();

    /**
     * 这个事件处理有一个取巧的地方，
     * 为了避免一次重复取文件内容，
     * 所以先获取序列化的静态 mirror，
     * 通过比对这个 mirror 的内容来判断是否需要更新版本，
     * 然后重新设置 mirror 的 base 版本号
     */
    this.watchService.onChanged(async (ref) => {
      const { uri } = ref;
      const mirror = await this.resolve(uri.toString());
      const md5Value = md5(mirror.lines.join(mirror.eol));

      if (ref.md5 !== md5Value) {
        ref.nextVersion(md5Value);
      }

      mirror.base = ref.version;

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
    const ref = await this.refManager.resolveReference(uri);
    const encoding = await this.fileService.getEncoding(uri);
    const { content } = await this.fileService.resolveContent(uri, { encoding });
    const lines = content.split(staticConfig.eol);

    /**
     * 语言先全部交给前台来判断
     */
    const language = ''; // filename2Language(uri);

    this.watchService.watch(uri);

    if (!encoding) {
      throw new Error('Can not get file encoding');
    }

    return {
      uri, lines, language, encoding,
      eol: staticConfig.eol,
      base: ref.version.toJSON(),
    };
  }

  private async _saveFile(uri: URI, stack: Array<monaco.editor.IModelContentChange>, encoding: string) {
    let stat = await this.fileService.getFileStat(uri.toString());

    if (!stat) {
      throw new Error('Get file stat failed');
    }

    const ref = await this.refManager.resolveReference(uri);
    const res = await this.fileService.resolveContent(uri.toString(), { encoding });
    const nextContent = applyChanges(res.content, stack);
    const md5Value = md5(nextContent);

    /**
     * 内容一致，无需保存
     */
    if (md5Value === ref.md5) {
      return { stat };
    }

    stat = await this.fileService.setContent(stat, nextContent, { encoding });

    if (!stat) {
      throw new Error('Save file failed');
    }

    return { stat, md5: md5Value };
  }

  async persist(statMirror: IDocumentModelStatMirror, stack: Array<monaco.editor.IModelContentChange>,  override?: boolean) {
    const { uri, encoding, base } = statMirror;

    const ref = await this.refManager.resolveReference(uri);
    const stat = await this.fileService.getFileStat(ref.uri.toString());

    if (!stat) {
      /**
       * 当文件不存在的时候，
       * 这个时候我们实际需要为这个前台文档创建一个新的源文件。
       */
      if (base.type === VersionType.browser) {
        await this.fileService.createFile(ref.uri.toString(), {
          content: '',
          encoding,
        });
        await this._saveFile(ref.uri, stack, encoding);
        const mirror = await this.resolve(uri);
        return { ...mirror, lines: undefined };
      } else {
        throw new Error('Base version must be browser while file is not existed');
      }
    } else if (override) {
      /**
       * 合并操作已经在前台完成，
       * 我们在后台生成一个新的基版本并返回给前台。
       */
      const res = await this._saveFile(ref.uri, stack, encoding);
      if (res) {
        const { md5: md5Value } = res;
        // 生成一个新的基版本
        ref.nextVersion(md5Value);
        const mirror = await this.resolve(uri);
        return { ...mirror, lines: undefined };
      }
    } else if (Version.equal(ref.version, base)) {
      /**
       * 线上文档和本地文件的基版本相同，
       * 不需要进行合并操作，直接保存到本地。
       */
      const res = await this._saveFile(ref.uri, stack, encoding);
      if (res) {
        const { md5: md5Value } = res;
        if (md5Value) {
          ref.refreshContent(md5Value);
        }
        return statMirror;
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
