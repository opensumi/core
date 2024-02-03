import Fury from '@furyjs/fury/dist/lib/fury';

export const furyFactory = () => {
  const fury = Fury({});
  const reader = fury.binaryReader;
  const writer = fury.binaryWriter;

  return {
    fury,
    reader,
    writer,
  };
};

export type FuryFactoryReturn = ReturnType<typeof furyFactory>;
