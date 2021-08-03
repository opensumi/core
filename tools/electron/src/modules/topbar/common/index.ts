export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
}
export const ITopbarNodeServer = 'ITopbarNodeServer';
export const TopbarNodeServerPath = 'TopbarNodeServerPath';
export interface ITopbarNodeServer {
  topbarHello: () => void;
}

export const ITopbarService = 'ITopbarService';
export interface ITopbarService {

  sayHelloFromNode: () => void;

}
