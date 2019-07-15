import { IDisposable } from './disposable';


export interface IElectronMainApi<Events> {

  on(event: Events, listener: (...args) => void) :IDisposable;

}


export interface IElectronMainUIService extends IElectronMainApi<void> {

  maximize(windowId: number): Promise<void>;

}

export const IElectronMainUIService = Symbol('IElectronMainUIService');