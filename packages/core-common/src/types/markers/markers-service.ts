import { IMarkerData, MarkerStatistics } from './markers';

export interface IMarkerService {

  /**
   * 更新markers
   * @param type 类型标识
   * @param uri markers对应的资源
   * @param markers 所有markers
   */
  updateMarkers(type: string, uri: string, markers: IMarkerData[]);


  /**
   * 获取markers
   * @param type 类型标识
   */
  getMarkers(type: string);

  /**
   * 获取所有markers
   */
  getAllMarkers();

  /**
   * 清空markers
   * @param type 类型标识
   */
  clearMarkers(type: string);


  /**
   * 清空所有markers
   */
  clearAll();


  /**
   * 获取所有markers的统计信息
   */
  getStatistics(): MarkerStatistics;

  /**
   * 是否有marker
   */
  hasMarkers(): boolean;
}
