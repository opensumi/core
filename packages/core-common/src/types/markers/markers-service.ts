import { IMarker, IMarkerData, MarkerStatistics, MarkerSeverity } from './markers';
import { IDisposable } from '../../disposable';
import { Event } from '../../event';

export interface IBaseMarkerService {
   /**
   * 更新markers
   * @param type 类型标识
   * @param uri markers对应的资源
   * @param markers 所有markers
   */
  updateMarkers(type: string, uri: string, markers: IMarkerData[]);

  /**
   * 清空markers
   * @param type 类型标识
   */
  clearMarkers(type: string);

   /**
   * 获取所有markers的统计信息
   */
  getStats(): MarkerStats;

   /**
   * 获取markers
   */
  getMarkers(filter: { type?: string; resource?: string; severities?: number, take?: number; }): IMarker[];

  /**
   * marker变更事件
   */
  onMarkerChanged: Event<string[]>;
}


export class MarkerStats implements MarkerStatistics {

	public errors: number = 0;
	public infos: number = 0;
	public warnings: number = 0;
	public unknowns: number = 0;

  private _data?: { [resource: string]: MarkerStatistics } = Object.create(null);
  private _service: IBaseMarkerService;
	private _subscription: IDisposable;

	constructor(service: IBaseMarkerService) {
		this._service = service;
		this._subscription = service.onMarkerChanged(this._update, this);
	}

	dispose(): void {
		this._subscription.dispose();
		this._data = undefined;
	}

	private _update(resources: string[]): void {
		if (!this._data) {
			return;
		}

		for (const resource of resources) {
			const key = resource.toString();
			const oldStats = this._data[key];
			if (oldStats) {
				this._substract(oldStats);
			}
			const newStats = this._resourceStats(resource);
			this._add(newStats);
			this._data[key] = newStats;
		}
	}

	private _resourceStats(resource: string): MarkerStatistics {
		const result: MarkerStatistics = { errors: 0, warnings: 0, infos: 0, unknowns: 0 };

    const markers = this._service.getMarkers({ resource });
		for (const { severity } of markers) {
			if (severity === MarkerSeverity.Error) {
				result.errors += 1;
			} else if (severity === MarkerSeverity.Warning) {
				result.warnings += 1;
			} else if (severity === MarkerSeverity.Info) {
				result.infos += 1;
			} else {// Hint
				result.unknowns += 1;
			}
		}

		return result;
	}

	private _substract(op: MarkerStatistics) {
		this.errors -= op.errors;
		this.warnings -= op.warnings;
		this.infos -= op.infos;
		this.unknowns -= op.unknowns;
	}

	private _add(op: MarkerStatistics) {
		this.errors += op.errors;
		this.warnings += op.warnings;
		this.infos += op.infos;
		this.unknowns += op.unknowns;
	}
}
