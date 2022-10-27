export const MockExtensionStorageService = {
  whenReady: Promise.resolve(true),
  extensionStoragePath: {},
  set() {},
  get() {},
  getAll() {
    return Promise.resolve({});
  },
  reConnectInit() {},
  getLastStoragePath() {
    return Promise.resolve('~/.sumi');
  },
};
