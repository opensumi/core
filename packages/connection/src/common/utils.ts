export function stringify(obj: any): string {
  return JSON.stringify(obj);
}

export function parse(input: string, reviver?: (this: any, key: string, value: any) => any): any {
  return JSON.parse(input, reviver);
}
