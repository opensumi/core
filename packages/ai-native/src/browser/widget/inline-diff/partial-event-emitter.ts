import { Emitter } from '@opensumi/ide-utils';

import { IPartialEditEvent } from '../inline-stream-diff/live-preview.component';

export const PartialEventEmitter = Symbol('PartialEventEmitter');
export type PartialEventEmitter = Emitter<IPartialEditEvent>;
