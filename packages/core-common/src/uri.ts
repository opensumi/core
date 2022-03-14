import { URI as Uri } from 'vscode-uri';

import { Path } from './path';
import { IRelativePattern, match } from './utils/glob';

export { URI as Uri, Utils as UriUtils } from 'vscode-uri';
// 3.0 的 vscode-uri 没有导出这个
export interface UriComponents {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

export class URI {
  static from(components: { scheme: string; authority?: string; path?: string; query?: string; fragment?: string }) {
    return new URI(Uri.from(components));
  }

  static file(path: string) {
    return new URI(Uri.file(path));
  }

  static parse(path: string) {
    return new URI(Uri.parse(path));
  }

  static isUri(thing: any): thing is URI {
    if (thing instanceof URI) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Uri.isUri(thing);
  }

  static isUriString(str: string): boolean {
    return !!str && /^[A-Za-z\-\_]+:\/\//.test(str);
  }

  static revive(data: any) {
    return Uri.revive(data);
  }

  public readonly codeUri: Uri;
  private _path: Path | undefined;

  constructor(uri: string | Uri = '') {
    if (Uri.isUri(uri)) {
      this.codeUri = uri;
    } else {
      this.codeUri = Uri.parse(uri);
    }
  }

  get displayName(): string {
    const base = this.path.base;
    if (base) {
      return base;
    }
    if (this.path.isRoot) {
      return this.path.toString();
    }
    return '';
  }

  /**
   * Return all uri from the current to the top most.
   */
  get allLocations(): URI[] {
    const locations: any[] = [];
    let location: URI = this;
    while (!location.path.isRoot) {
      locations.push(location);
      location = location.parent;
    }
    locations.push(location);
    return locations;
  }

  get parent(): URI {
    if (this.path.isRoot) {
      return this;
    }
    return this.withPath(this.path.dir);
  }

  relative(uri: URI): Path | undefined {
    if (this.authority !== uri.authority || this.scheme !== uri.scheme) {
      return undefined;
    }
    return this.path.relative(uri.path);
  }

  resolve(path: string | Path): URI {
    return this.withPath(this.path.join(path.toString()));
  }

  /**
   * return a new URI replacing the current with the given scheme
   */
  withScheme(scheme: string): URI {
    const newCodeUri = Uri.from({
      ...this.codeUri.toJSON(),
      scheme,
    });
    return new URI(newCodeUri);
  }

  /**
   * @deprecated
   * return this URI without a scheme
   */
  withoutScheme(): URI {
    /**
     * 本方法已废弃
     * 由于 vscode-uri 自 1.0.8 起，内部强制校验和修正 `scheme` 参数
     * 会将 scheme 为空时强制修正为 `file` (不可关闭)
     * 会在不传入 scheme 时报错 (可通过 setUriThrowOnMissingScheme 关闭)
     * 因此这里直接调用 `new Uri` 产生一个不带 scheme 的 Uri 实例
     * ---- !!!!!!! ATTENTION ----
     * 这样做的影响是 Uri 的实例 toJSON 时没有 $mid 参数，会在通信序列化时无法传输
     * ---- !!!!!!! ATTENTION ----
     * 但是 vscode-uri 对 constructor 属性加了 protected 保护，因此增加了 `ts-ignore`
     */
    if (process.env.NODE_ENV !== 'production' && console !== undefined) {
      // eslint-disable-next-line no-console
      console.warn(
        'Warning: `Uri.withoutScheme` is deprecated, ' +
          'If you want to get `fsPath` by `withoutScheme` method, ' +
          "it's recommended to use `uri.path.toString` directly",
      );
    }

    // @ts-ignore
    const newCodeUri = new Uri({
      ...this.codeUri.toJSON(),
      scheme: '',
    });

    return new URI(newCodeUri);
  }

  /**
   * return a new URI replacing the current with the given authority
   */
  withAuthority(authority: string): URI {
    const newCodeUri = Uri.from({
      ...this.codeUri.toJSON(),
      scheme: this.codeUri.scheme,
      authority,
    });
    return new URI(newCodeUri);
  }

  /**
   * return this URI without a authority
   */
  withoutAuthority(): URI {
    return this.withAuthority('');
  }

  /**
   * return a new URI replacing the current with the given path
   */
  withPath(path: string | Path): URI {
    const newCodeUri = Uri.from({
      ...this.codeUri.toJSON(),
      scheme: this.codeUri.scheme,
      path: path.toString(),
    });
    return new URI(newCodeUri);
  }

  /**
   * return this URI without a path
   */
  withoutPath(): URI {
    return this.withPath('');
  }

  /**
   * return a new URI replacing the current with the given query
   */
  withQuery(query: string): URI {
    const newCodeUri = Uri.from({
      ...this.codeUri.toJSON(),
      scheme: this.codeUri.scheme,
      query,
    });
    return new URI(newCodeUri);
  }

  /**
   * return this URI without a query
   */
  withoutQuery(): URI {
    return this.withQuery('');
  }

  /**
   * return a new URI replacing the current with the given fragment
   */
  withFragment(fragment: string): URI {
    const newCodeUri = Uri.from({
      ...this.codeUri.toJSON(),
      scheme: this.codeUri.scheme,
      fragment,
    });
    return new URI(newCodeUri);
  }

  /**
   * return this URI without a fragment
   */
  withoutFragment(): URI {
    return this.withFragment('');
  }

  get scheme(): string {
    return this.codeUri.scheme;
  }

  get authority(): string {
    return this.codeUri.authority;
  }

  get path(): Path {
    if (this._path === undefined) {
      this._path = new Path(this.codeUri.path);
    }
    return this._path;
  }

  get query(): string {
    return this.codeUri.query;
  }

  get fragment(): string {
    return this.codeUri.fragment;
  }

  toString(skipEncoding?: boolean) {
    return this.codeUri.toString(skipEncoding);
  }

  isEqualOrParent(uri: URI): boolean {
    return this.authority === uri.authority && this.scheme === uri.scheme && this.path.isEqualOrParent(uri.path);
  }

  isEqual(uri: URI): boolean {
    return (
      this.authority === uri.authority &&
      this.scheme === uri.scheme &&
      this.path.isEqual(uri.path) &&
      this.query === uri.query
    );
  }

  matchGlobPattern(pattern: string | IRelativePattern): boolean {
    return match(pattern, this.path.toString());
  }

  static getDistinctParents(uris: URI[]): URI[] {
    const result: URI[] = [];
    uris.forEach((uri, i) => {
      if (!uris.some((otherUri, index) => index !== i && otherUri.isEqualOrParent(uri))) {
        result.push(uri);
      }
    });
    return result;
  }

  getParsedQuery(): { [key: string]: string } {
    const queryString = this.query;
    const query = {};
    const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i].split('=');
      query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
  }

  static stringifyQuery(query: { [key: string]: any }): string {
    const values: string[] = [];
    Object.keys(query).forEach((key) => {
      const value = encodeURIComponent(query[key]);
      if (value !== undefined) {
        values.push(encodeURIComponent(key) + '=' + value);
      }
    });
    return values.join('&');
  }
}
