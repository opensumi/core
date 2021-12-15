export interface IMainThreadCommon {
  $subscribeEvent(eventName): Promise<void>;
  $unSubscribeEvent(eventName): Promise<void>;
}

export interface IExtHostCommon {
  $acceptEvent(eventName: string, eventArgs: any[]): Promise<any[]>;
}

export interface IExtHostEventResult {
  err?: string;
  result: any;
}
