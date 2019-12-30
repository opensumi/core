import { BasicEvent } from '@ali/ide-core-browser';

export type Serializable = any;

export interface IExtHostEventPayload {
  eventName: string;
  eventArgs: Serializable[];
}

export class ExtHostEvent extends BasicEvent<IExtHostEventPayload> {}
