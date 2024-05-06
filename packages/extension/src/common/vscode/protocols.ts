import { ExtensionDocumentProtocol } from '@opensumi/ide-connection/lib/common/protocols/extensions/ext-host-documents';

import { ExtHostAPIIdentifier } from '.';

export const knownProtocols = {
  [ExtHostAPIIdentifier.ExtHostDocuments.serviceId]: ExtensionDocumentProtocol,
};
