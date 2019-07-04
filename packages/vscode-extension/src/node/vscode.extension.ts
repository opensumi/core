import {Injectable} from '@ali/common-di';
import * as path from 'path';
import {VSCodeExtensionNodeService} from '../common';

@Injectable()
export class VSCodeExtensionNodeServiceImpl implements VSCodeExtensionNodeService {
  public async getExtHostPath() {
  if (__dirname.indexOf('vscode-extension/lib') !== -1) {
      return path.join(__dirname, './ext.host.js');
    } else {
      return path.join(__dirname, '../../lib/node/ext.host.js');
    }
  }
}
