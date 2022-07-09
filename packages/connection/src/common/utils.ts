export function stringify(obj: any): string {
  return JSON.stringify(obj);
}

export function parse(input: string, reviver?: (this: any, key: string, value: any) => any): any {
  return JSON.parse(input, reviver);
}

declare global {
  interface Window {
    __opensumi_devtools: any;
  }
}

export function getCapturer() {
  if (typeof window !== 'undefined' && window.__opensumi_devtools && window.__opensumi_devtools.capture) {
    return window.__opensumi_devtools.capture;
  }
  return;
}

export function genrateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
