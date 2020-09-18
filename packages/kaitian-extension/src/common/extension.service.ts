import { IRPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { Event, IExtensionProps } from '@ali/ide-core-common';
import { Extension } from '../browser/extension';
import { ActivatedExtensionJSON } from './activator';

import { IExtension } from './index';

type ExtensionChangeKind = 'install' | 'uninstall' | 'upgrade' | 'enable' | 'disable';

export interface IExtensionChangeEvent {
  kind: ExtensionChangeKind;
  extension: IExtension;
}

export abstract class AbstractExtensionService {
  abstract async activate(): Promise<IRPCProtocol>;

  abstract initExtension(extensions: Extension[]): Promise<void>;
  abstract async activeExtension(extension: IExtension): Promise<void>;

  abstract onDidExtensionChange: Event<IExtensionChangeEvent>;
  abstract getExtension(extensionId: string): IExtension | undefined;
  abstract getActivatedExtensions(): Promise<ActivatedExtensionJSON[]>;

  abstract getHostProtocol(): IRPCProtocol | undefined;

  abstract $getExtensions(): IExtensionProps[];

}
