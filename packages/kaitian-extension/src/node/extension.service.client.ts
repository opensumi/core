import { Injectable, Autowired } from '@ali/common-di';

import { ExtraMetaData, IExtensionMetaData, IExtensionNodeService, IExtensionNodeClientService } from '../common';

@Injectable()
export class ExtensionSeviceClientImpl implements IExtensionNodeClientService {

  @Autowired(IExtensionNodeService)
  private extensionService: IExtensionNodeService;

  /**
   * 创建插件进程
   *
   * @param clientId 客户端 id
   */
  public async createProcess(clientId: string): Promise<void> {
    await this.extensionService.createProcess2(clientId);
  }

  /**
   * 获取插件信息
   *
   * @param extensionPath 插件路径
   * @param extraMetaData 补充数据
   */
  public async getExtension(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await this.extensionService.getExtension(extensionPath, extraMetaData);
  }

  /**
   * 获取所有插件
   *
   * @param scan 插件存放目录
   * @param extenionCandidate 执行插件目录
   * @param extraMetaData 扫描数据字段
   */
  public async getAllExtensions(
    scan: string[],
    extenionCandidate: string[],
    extraMetaData: {[key: string]: any}): Promise<IExtensionMetaData[]> {

      return await this.extensionService.getAllExtensions(scan, extenionCandidate, extraMetaData);
  }

}
