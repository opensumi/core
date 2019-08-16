import { IDocumentModel, IDocumentModelManager, IDocumentModelRef, IDocumentModelMirror } from '../common';
import { URI } from '@ali/ide-core-browser';

export interface IDocumentModelManagerImpl extends IDocumentModelManager {

  // 获得一个
  getAllModels(): IDocumentModel[];
  /**
   * 保存文本文档的修改到本地空间，
   * TODO: 将全量修改优化为局部修改。
   * @param uri 文件地址
   */
  saveModel(uri: string | URI): Promise<boolean>;

  /**
   * 数据源获得一手数据
   * @param uri
   */
  getPersistentMirror(uri: URI): Promise<IDocumentModelMirror | null>;

}
