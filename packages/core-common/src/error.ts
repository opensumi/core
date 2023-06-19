export function throwNonElectronError(name: string): never {
  throw new Error(`This method(${name}) is not implemented for non-electron environment`);
}
