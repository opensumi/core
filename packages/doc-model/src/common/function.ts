import { Disposable, IDisposable } from '@ali/ide-core-common';

export async function callFuncArray<F = () => any>(funs: F[], thisArgs: any = {}, ..._argv: any) {
  const argv = _argv || [];

  for (const fun of funs) {
    // @ts-ignore
    const res = await fun.apply(thisArgs, ...argv);

    if (res) {
      return res;
    }
  }

  return null;
}

export async function callAsyncProvidersMethod<I = any>(providers: I[], method: string, ..._argv: any) {
  const argv = _argv || [];

  for (const provider of providers) {
    // @ts-ignore
    const func = provider[method];
    const res = await func.call(provider, ...argv);
    if (res !== null && typeof res !== undefined) {
      return res;
    }
  }

  return null;
}

export function callVoidProvidersMethod<I = any>(providers: I[], method: string, ..._argv: any): IDisposable {
  const disposes = new Disposable();
  const argv = _argv || [];

  for (const provider of providers) {
    // @ts-ignore
    const func = provider[method];
    const dispose = func.call(provider, ...argv);

    if (dispose) {
      disposes.addDispose(dispose);
    }
  }

  return disposes;
}
