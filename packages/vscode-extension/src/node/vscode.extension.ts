import {Injectable} from '@ali/common-di';
import * as path from 'path';
import {VSCodeExtensionNodeService} from '../common';

@Injectable()
export class VSCodeExtensionNodeServiceImpl implements VSCodeExtensionNodeService {
  public async getExtHostPath() {
    return path.join(__dirname, './ext.host' + path.extname(module.filename));
  }
}
