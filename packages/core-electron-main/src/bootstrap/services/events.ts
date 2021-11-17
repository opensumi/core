import { BasicEvent } from '@ide-framework/ide-core-common';
import { ICodeWindow } from '../types';

export class WindowCreatedEvent extends BasicEvent<ICodeWindow> {}

export class WindowDestroyedEvent extends BasicEvent<ICodeWindow> {}
