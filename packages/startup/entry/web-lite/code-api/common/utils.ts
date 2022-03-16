export class RetryError extends Error {}

export const retry = (target: any, key: string, descriptor: any) => {
  const fn = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    try {
      return await fn.call(this, ...args);
    } catch (err) {
      if (err instanceof RetryError) {
        return fn.call(this, ...args);
      }
      throw err;
    }
  };
};

/**
 * 解析代码托管平台 url，获取相关数据信息
 */
export const parseCodeHostURL = (href: string) => {
  if (!href) {return null;}
};
