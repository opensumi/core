import { isIterable } from '@opensumi/ide-utils';

export type Query = Record<any, any>;
export type Store<T> = Iterable<T> | Record<any, T> | Map<any, T>;

function makeMatcher(query: Query) {
  const statements = [] as string[];
  Object.entries(query).forEach(([key, value]) => {
    statements.push(`item[${JSON.stringify(key)}] === ${JSON.stringify(value)}`);
  });

  const matcher = `
    return ${statements.join(' && ')};
  `;

  return new Function('item', matcher) as (item: any) => boolean;
}

export function select<I, T extends Store<I>>(items: T, query: Query): I[] {
  const matcher = makeMatcher(query);
  const result = [] as I[];

  let _iterable: Iterable<any> | undefined;

  if (items instanceof Map) {
    _iterable = items.values();
  } else if (isIterable(items)) {
    _iterable = items;
  } else {
    _iterable = Object.values(items);
  }

  for (const item of _iterable) {
    if (matcher(item)) {
      result.push(item);
    }
  }

  return result;
}
