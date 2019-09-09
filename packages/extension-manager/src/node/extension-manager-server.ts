import { Injectable } from '@ali/common-di';
import { IExtensionManagerServer, RawExtension, MARKETPLACE } from '../common';
import * as urllib from 'urllib';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {
  async search(query: string) {
    return await this.request(`/api/ide/search?query=${query}`);
  }
  async getExtensionFromMarketPlace(extensionId: string) {
    return await this.request(`/api/ide/extension/${extensionId}`);
  }

  async request(path: string) {
    const res = await urllib.request(`${MARKETPLACE}${path}`, {
      dataType: 'json',
    });
    if (res.status === 200) {
      return res.data;
    } else {
      throw new Error('请求错误');
    }
  }
}
