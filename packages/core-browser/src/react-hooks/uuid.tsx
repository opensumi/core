import { useMemo } from 'react';

import { uuid } from '@opensumi/ide-core-common';

export function useUUID(): string {
  const id = useMemo(() => uuid(6), []);
  return id;
}
