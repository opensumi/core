import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier } from '../../common';
import { ExtensionDocumentDataManagerImpl } from '../doc/doc-manager.host';

export function createDocumentModelApiFactory(rpcProtocol: IRPCProtocol) {
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));

  return {

  };
}
