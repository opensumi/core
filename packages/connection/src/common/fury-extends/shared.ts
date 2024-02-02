import Fury from '@furyjs/fury/dist/lib/fury';

export const fury = Fury({});
export const reader = fury.binaryReader;
export const writer = fury.binaryWriter;
