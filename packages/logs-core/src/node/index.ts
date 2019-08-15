import { Injectable } from '@ali/common-di';
import { BasicModule } from '@ali/ide-core-common';
import { LogServicePath } from '../common/';
import { LogServiceManage } from './log-manage';

const logServiceMange = new LogServiceManage();

export default logServiceMange;

@Injectable()
export class FileServiceModule extends BasicModule {
  providers = [];

  backServices = [
    {
      servicePath: LogServicePath,
      // token: IFileService,
    },
  ];
}

// 每次启动时执行清理
logServiceMange.cleanOldLogs();
