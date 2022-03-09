import { IRPCProtocol } from '@opensumi/ide-connection';

import { IExtensionHostService, IExtensionWorkerHost } from '../../../common';
import { IExtensionDescription } from '../../../common/vscode';
import { ExtensionHostEditorService } from '../vscode/editor/editor.host';
import { createCommandsApiFactory, ExtHostCommands } from '../vscode/ext.host.command';

import { ExtHostAPIIdentifier } from './../../../common/vscode/index';

interface IOptions {
  firstParty?: boolean;
  debug?: boolean;
}

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  _type: string,
) {
  const extHostCommands = rpcProtocol.get(ExtHostAPIIdentifier.ExtHostCommands) as ExtHostCommands;
  const extHostEditors = rpcProtocol.get(ExtHostAPIIdentifier.ExtHostEditors) as ExtensionHostEditorService;
  const logger = extensionService.logger;

  const createUuid = () => Math.random();

  const sendOperationStart = (operationId: string, operationName: string) => {
    logger.warn('Method not implemented.');
  };

  const instrumentOperation =
    (
      operationName: string,
      cb: (operationId: string, ...args: any[]) => any,
      thisArg?: any,
    ): ((...args: any[]) => any) =>
    async (...args: any[]) => {
      const operationId = createUuid();
      try {
        return await cb.apply(thisArg, [operationId, ...args]);
      } catch (e) {}
    };

  const instrumentSimpleOperation = (operationName: string, cb: (...args: any[]) => any, thisArg?: any) =>
    instrumentOperation(operationName, async (operationId, ...args) => await cb.apply(thisArg, args), thisArg);

  return (extension: IExtensionDescription) => ({
    instrumentOperation,
    sendOperationStart,
    createUuid,
    instrumentSimpleOperation,
    initializeFromJsonFile(jsonFilepath: string, options?: IOptions) {
      logger.warn('Method not implemented.');
    },
    initialize(extensionId: string, version: string, aiKey: string | string[], options?: IOptions) {
      logger.warn('Method not implemented.');
    },
    setUserError(err: Error) {
      logger.warn('Method not implemented.');
    },
    setErrorCode(err: Error, errorCode: number) {
      logger.warn('Method not implemented.');
    },
    instrumentOperationAsVsCodeCommand(command: string, cb: (...args: any[]) => any, thisArg?: any): any {
      const vscodeCommands = createCommandsApiFactory(extHostCommands, extHostEditors, extension);
      return vscodeCommands.registerCommand(command, instrumentSimpleOperation(command, cb, thisArg));
    },
    sendOperationEnd(operationId: string, operationName: string, duration: number, err?: Error) {
      logger.warn('Method not implemented.');
    },
    sendError(err: Error) {
      logger.warn('Method not implemented.');
    },
    sendOperationError(operationId: string, operationName: string, err: Error) {
      logger.warn('Method not implemented.');
    },
    sendInfo(operationId: string, data: { [key: string]: string | number }) {
      logger.warn('Method not implemented.');
    },
    instrumentOperationStep(operationId: string, stepName: string, cb: (...args: any[]) => any): any {
      return async (...args: any[]) => {
        try {
          return await cb(...args);
        } catch (e) {}
      };
    },
    dispose() {
      logger.warn('Method not implemented.');
    },
    addContextProperty(name: string, value: string) {
      logger.warn('Method not implemented.');
    },
  });
}
