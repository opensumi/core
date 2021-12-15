import { BasicEvent } from '@opensumi/ide-core-common';

export enum ContentChangeType {
  appendLine,
  append,
  clear,
}

export class ContentChangeEventPayload {
  constructor(
    public channelName: string,
    public changeType: ContentChangeType,
    public value: string,
    public lines: string[],
  ) {}
}
export class ContentChangeEvent extends BasicEvent<ContentChangeEventPayload> {}
