import { BasicEvent } from '@ali/ide-core-common';
import { OutputChannel } from '../browser/output.channel';

export enum ContentChangeType {
  appendLine,
  append,
  clear,
}

export class ContentChangeEventPayload {
  constructor(public channelName: string, public changeType: ContentChangeType, public value: string, public lines: string[]) {

  }

}
export class ContentChangeEvent extends BasicEvent<ContentChangeEventPayload> {}
