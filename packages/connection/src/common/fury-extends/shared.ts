import Fury from '@furyjs/fury/dist/lib/fury';

import type { Config } from '@furyjs/fury/dist/lib/type';

export const furyFactory = (config?: Config) => {
  const fury = new Fury(config);
  const reader = fury.binaryReader;
  const writer = fury.binaryWriter;

  return {
    fury,
    reader,
    writer,
  };
};

export type FuryFactoryReturn = ReturnType<typeof furyFactory>;
export type Writer = FuryFactoryReturn['writer'];
export type Reader = FuryFactoryReturn['reader'];
