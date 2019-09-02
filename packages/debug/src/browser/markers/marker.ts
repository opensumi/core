export interface Marker<T> {
  /**
   * 遮罩元素定位的uri
   */
  uri: string;
  /*
   * 遮罩元素的注册者
   */
  owner: string;

  /**
   * 类型
   */
  kind?: string;

  /*
   * 缓存数据
   */
  data: T;
}
