export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';

export const stripLeadingSlash = (path: string) => (path.charAt(0) === '/' ? path.substr(1) : path);

export const stripTrailingSlash = (path: string) => (path.charAt(path.length - 1) === '/' ? path.slice(0, -1) : path);

export const createUrl = (origin: string, path: string) => `${stripTrailingSlash(origin)}/${stripLeadingSlash(path)}`;

export interface RequestOptions extends RequestInit {
  baseURL?: string;
  params?: Record<string, any>;
  data?: any;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
}

export interface Request {
  <T = any>(url: string, options?: RequestOptions): Promise<T>;
  get: Request;
  post: Request;
  delete: Request;
  put: Request;
  patch: Request;
  head: Request;
  options: Request;
}

export class ResponseError extends Error {
  constructor(
    message: string,
    public name: string,
    public request: RequestOptions & { url: string },
    public response: Response,
  ) {
    super(message);
  }
}

export const isResponseError = (err: any): err is ResponseError => err instanceof ResponseError;

const defaultValidateStatus = (status: number) => status >= 200 && status < 300;

const requestImpl: any = async (url: string, options?: RequestOptions) => {
  options = options || {};
  const { data, params, responseType, baseURL, ...opts } = options;

  opts.method = options.method ? options.method.toUpperCase() : 'GET';
  opts.credentials = opts.credentials || 'same-origin';

  if (baseURL) {
    url = createUrl(baseURL, url);
  }

  const urlInstance = new URL(url, location.origin);

  if (params) {
    Object.keys(params).forEach((key) => {
      let value = params[key];
      if (!Array.isArray(value)) {
        value = [value];
      }
      value.forEach((v) => {
        if (v != null) {
          urlInstance.searchParams.append(key, v);
        }
      });
    });
  }

  if (data && ['post', 'put', 'patch', 'delete'].indexOf(opts.method.toLowerCase()) > -1) {
    const headers = new Headers(options.headers);

    if (Object.prototype.toString.call(data) === '[object Object]') {
      opts.body = JSON.stringify(data);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json;charset=utf-8');
      }
    } else if (typeof data === 'string') {
      opts.body = data;
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/x-www-form-urlencoded;charset=utf-8');
      }
    }
    opts.headers = headers;
  }

  const response = await fetch(urlInstance.toString(), opts);

  const validateStatus = options.validateStatus || defaultValidateStatus;

  if (!validateStatus(response.status)) {
    throw new ResponseError(
      response.statusText || 'Request Error',
      'ResponseError',
      { url: urlInstance.toString(), ...opts },
      response,
    );
  }

  return responseType ? response[responseType]() : response;
};

const METHODS = ['get', 'post', 'delete', 'put', 'patch', 'head', 'options'];
METHODS.forEach((method) => {
  requestImpl[method] = (url: string, options: RequestOptions) => request(url, { ...options, method });
});

export const request: Request = requestImpl;
