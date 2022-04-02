import stripJsonComments from 'strip-json-comments';

/**
 * JSON对象的值为引用类型的类型
 */
export type JSONPrimitive = boolean | number | string | null;

/**
 * JSON对象值类型
 */
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

/**
 * JSON Object值类型
 */
export interface JSONObject {
  [key: string]: JSONValue;
}

/**
 * JSON Array值类型
 */
export type JSONArray = Array<JSONValue>;

/**
 * 只读的JSON Object类型
 */
export interface ReadonlyJSONObject {
  readonly [key: string]: ReadonlyJSONValue;
}

/**
 * 只读的JSON Array类型
 */
export type ReadonlyJSONArray = ReadonlyArray<ReadonlyJSONValue>;

/**
 * 只读的JSON值类型
 */
export type ReadonlyJSONValue = JSONPrimitive | ReadonlyJSONObject | ReadonlyJSONArray;

/**
 * JSON 工具方法空间
 */
export namespace JSONUtils {
  /**
   * 冻结的空JSON Object
   */
  export const emptyObject = Object.freeze({}) as ReadonlyJSONObject;

  /**
   * 冻结的空JSON Array
   */
  export const emptyArray = Object.freeze([]) as ReadonlyJSONArray;

  /**
   * 判断JSON是否为普通类型值，如JSONPrimitive
   * @param value
   */
  export function isPrimitive(value: ReadonlyJSONValue): value is JSONPrimitive {
    return value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';
  }

  /**
   * 判断JSON值是否为Array
   * @param value
   */
  export function isArray(value: JSONValue): value is JSONArray;
  export function isArray(value: ReadonlyJSONValue): value is ReadonlyJSONArray;
  export function isArray(value: ReadonlyJSONValue): boolean {
    return Array.isArray(value);
  }

  /**
   * 判断JSON值是否为Object.
   * @param value
   */
  export function isObject(value: JSONValue): value is JSONObject;
  export function isObject(value: ReadonlyJSONValue): value is ReadonlyJSONObject;
  export function isObject(value: ReadonlyJSONValue): boolean {
    return !isPrimitive(value) && !isArray(value);
  }

  /**
   * 判断两个值是否深层相等
   * @param first
   * @param second
   */
  export function deepEqual(first: ReadonlyJSONValue, second: ReadonlyJSONValue): boolean {
    if (first === second) {
      return true;
    }

    if (isPrimitive(first) || isPrimitive(second)) {
      return false;
    }

    const a1 = isArray(first);
    const a2 = isArray(second);

    if (a1 !== a2) {
      return false;
    }

    if (a1 && a2) {
      return deepArrayEqual(first as ReadonlyJSONArray, second as ReadonlyJSONArray);
    }

    return deepObjectEqual(first as ReadonlyJSONObject, second as ReadonlyJSONObject);
  }

  /**
   * 深拷贝JSON值
   * @param value
   */
  export function deepCopy<T extends ReadonlyJSONValue>(value: T): T {
    if (isPrimitive(value)) {
      return value;
    }

    if (isArray(value)) {
      return deepArrayCopy(value);
    }

    return deepObjectCopy(value);
  }

  /**
   * 对比两个数组类型的JSON是否深匹配
   */
  function deepArrayEqual(first: ReadonlyJSONArray, second: ReadonlyJSONArray): boolean {
    if (first === second) {
      return true;
    }

    if (first.length !== second.length) {
      return false;
    }

    // Compare the values for equality.
    for (let i = 0, n = first.length; i < n; ++i) {
      if (!deepEqual(first[i], second[i])) {
        return false;
      }
    }

    // At this point, the arrays are equal.
    return true;
  }

  /**
   * 对比两个对象类型的JSON是否深匹配
   */
  function deepObjectEqual(first: ReadonlyJSONObject, second: ReadonlyJSONObject): boolean {
    if (first === second) {
      return true;
    }

    for (const key in first) {
      if (!(key in second)) {
        return false;
      }
    }

    // Check for the second object's keys in the first object.
    for (const key in second) {
      if (!(key in first)) {
        return false;
      }
    }

    // Compare the values for equality.
    for (const key in first) {
      if (!deepEqual(first[key], second[key])) {
        return false;
      }
    }

    // At this point, the objects are equal.
    return true;
  }

  /**
   * 深拷贝Array类型的值
   */
  function deepArrayCopy(value: any): any {
    const result = new Array<any>(value.length);
    for (let i = 0, n = value.length; i < n; ++i) {
      result[i] = deepCopy(value[i]);
    }
    return result;
  }

  /**
   * 深拷贝Object类型的值
   */
  function deepObjectCopy(value: any): any {
    const result: any = {};
    // eslint-disable-next-line guard-for-in
    for (const key in value) {
      result[key] = deepCopy(value[key]);
    }
    return result;
  }
}

export function parseWithComments<T>(content): T {
  content = stripTrailingComma(stripJsonComments(content));
  const res = JSON.parse(content);
  return res;
}

export function stripTrailingComma(content: string) {
  const subStrs: string[] = [];
  let lastIndex = 0;
  let inString = false;
  let i = 0;
  while (i < content.length) {
    if (inString) {
      if (content[i] === '"' && content[i - 1] !== '\\') {
        inString = false;
      }
    } else {
      if (content[i] === ',') {
        // 跳过空白
        const candidate = i;
        while (content[i + 1] && isWhiteSpace(content[i + 1])) {
          i++;
        }
        if (content[i + 1] === ']' || content[i + 1] === '}') {
          subStrs.push(content.substring(lastIndex, candidate));
          lastIndex = candidate + 1;
        }
      } else if (content[i] === '"') {
        // 肯定是开始字符串
        inString = true;
      }
    }
    i++;
  }
  if (lastIndex > 0) {
    subStrs.push(content.substr(lastIndex));
    return subStrs.join('');
  } else {
    return content;
  }
}

function isWhiteSpace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}
