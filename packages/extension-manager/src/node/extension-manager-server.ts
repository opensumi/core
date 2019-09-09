import { Injectable } from '@ali/common-di';
import { IExtensionManagerServer, RawExtension, MARKETPLACE } from '../common';
import * as urllib from 'urllib';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {
  async search(query: string): Promise<any> {
    const res = await this.request(`/api/ide/search?query=${query}`);

    if (res.status === 200) {
      return res.data;
    } else {
      throw new Error('请求错误');
    }
  }

  request(path: string) {
    return urllib.request(`${MARKETPLACE}${path}`, {
      dataType: 'json',
    });
  }
}
