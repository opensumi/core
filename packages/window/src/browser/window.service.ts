import { Injectable, Autowired } from '@ali/common-di';
import { IWindowService } from '../common';

@Injectable()
export class WindowServiceImpl implements IWindowService {
  openNewWindow(url: string): Window | undefined {
    const newWindow = window.open(url);
    if (newWindow === null) {
      throw new Error('Cannot open a new window for URL: ' + url);
    }
    return newWindow;
  }
}
