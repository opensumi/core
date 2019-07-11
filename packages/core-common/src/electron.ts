import { IDisposable } from './disposable';


export interface IElectronMainApi<Events> {

  on(event: Events, listener: (...args) => void) :IDisposable;

}
