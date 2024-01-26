type StringArg = string | number | null | undefined;
type ObjArg = Record<string, any>;
type ArrArg = Array<StringArg | ObjArg | ArrArg>;
export type ClxArgs = Array<StringArg | ObjArg | ArrArg>;

export function clx(...args: ClxArgs) {
  return args
    .reduce<Array<string | number>>((previousValue, currentValue) => {
      if (!currentValue) {
        return previousValue;
      }

      if (Array.isArray(currentValue)) {
        previousValue.concat(clx(...currentValue));
        return previousValue;
      }

      if (typeof currentValue === 'object') {
        Object.entries(currentValue).forEach(([k, v]) => {
          if (v) {
            previousValue.push(k);
          }
        });
        return previousValue;
      }

      previousValue.push(currentValue);
      return previousValue;
    }, [])
    .join(' ');
}

export type TArguments = Array<undefined | null | string | boolean | string[]>;

export function clxx(...args: TArguments | Array<TArguments>): string {
  return args
    .flat()
    .filter((x) => typeof x === 'string')
    .join(' ');
}
