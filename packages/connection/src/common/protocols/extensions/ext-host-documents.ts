import { Type } from '@furyjs/fury';

import { TSumiProtocol } from '../../rpc';
import { RangeProto } from '../common';

/**
 * {@link IExtensionHostDocService}
 */
export const ExtensionDocumentProtocol: TSumiProtocol = {
  name: 'ExtHostDocuments',
  methods: [
    {
      method: '$fireModelChangedEvent',
      request: [
        {
          name: 'event',
          type: Type.object('model-changed-event', {
            changes: Type.array(
              Type.object('model-changed-event-changes', {
                range: RangeProto,
                rangeLength: Type.uint32(),
                rangeOffset: Type.uint32(),
                text: Type.string(),
              }),
            ),
            uri: Type.string(),
            versionId: Type.uint32(),
            eol: Type.string(),
            dirty: Type.bool(),
            isRedoing: Type.bool(),
            isUndoing: Type.bool(),
          }),
        },
      ],
    },
    {
      method: '$fireModelOpenedEvent',
      request: [
        {
          name: 'event',
          type: Type.object('model-open-event', {
            uri: Type.string(),
            lines: Type.array(Type.string()),
            eol: Type.string(),
            versionId: Type.uint32(),
            languageId: Type.string(),
            dirty: Type.bool(),
          }),
        },
      ],
    },
    {
      method: '$provideTextDocumentContent',
      request: [
        {
          name: 'path',
          type: Type.string(),
        },
        {
          name: 'encoding',
          type: Type.string(),
        },
      ],
      response: {
        type: Type.string(),
      },
    },
  ],
};
