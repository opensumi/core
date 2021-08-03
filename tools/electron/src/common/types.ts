export const IHelloService = 'IHelloService';
export interface IHelloService {
  hello(): Promise<void>;
}
