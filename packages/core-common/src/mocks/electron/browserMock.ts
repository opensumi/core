import { MockedElectronIpcRenderer } from "./ipcRenderer";

export function mockElectronRenderer() {
  jest.mock('electron', () => {
    return {
      ipcRenderer: new MockedElectronIpcRenderer()
    }
  });
}