import { Type } from '@furyjs/fury';

export const UriComponentsProto = Type.object('uri-components', {
  scheme: Type.string(),
  authority: Type.string(),
  path: Type.string(),
  query: Type.string(),
  fragment: Type.string(),
});
