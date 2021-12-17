import { MockedElectronIpcRenderer } from './ipcRenderer';

export function mockElectronRenderer() {
  const mockedElectronIpcRenderer = new MockedElectronIpcRenderer();
  jest.mock('electron', () => ({
    ipcRenderer: mockedElectronIpcRenderer,
  }));

  (global as any).ipcRenderer = mockedElectronIpcRenderer;
}
