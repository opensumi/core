import { MockedElectronIpcRenderer } from "./ipcRenderer";

export function mockElectronRenderer() {
  const mockedElectronIpcRenderer = new MockedElectronIpcRenderer()
  jest.mock('electron', () => {
    return {
      ipcRenderer: mockedElectronIpcRenderer,
    }
  });

  (global as any).ipcRenderer = mockedElectronIpcRenderer;
}
