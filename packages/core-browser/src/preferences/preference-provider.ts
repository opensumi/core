import { Injectable } from '@ali/common-di';
import { IDisposable, DisposableCollection, Emitter, Event, URI, Deferred, JSONUtils, JSONValue } from '@ali/ide-core-common';
import { PreferenceScope } from '@ali/ide-core-common/lib/preferences/preference-scope';

export interface PreferenceProviderDataChange {
    readonly preferenceName: string;
    readonly newValue?: any;
    readonly oldValue?: any;
    readonly scope: PreferenceScope;
    readonly domain?: string[];
}

export interface PreferenceProviderDataChanges {
    [preferenceName: string]: PreferenceProviderDataChange;
}

export interface PreferenceResolveResult<T> {
    configUri?: URI;
    value?: T;
}

@Injectable()
export abstract class PreferenceProvider implements IDisposable {

    public readonly name: string;

    protected readonly onDidPreferencesChangedEmitter = new Emitter<PreferenceProviderDataChanges | undefined>();
    readonly onDidPreferencesChanged: Event<PreferenceProviderDataChanges | undefined> = this.onDidPreferencesChangedEmitter.event;

    protected readonly toDispose = new DisposableCollection();

    protected readonly _ready = new Deferred<void>();

    constructor() {
        this.toDispose.push(this.onDidPreferencesChangedEmitter);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    /**
     * 处理事件监听中接收到的Event数据对象
     * 以便后续接收到数据后能确认来自那个配置项的值
     */
    protected emitPreferencesChangedEvent(changes: PreferenceProviderDataChanges | PreferenceProviderDataChange[]): void {
      if (Array.isArray(changes)) {
            const prefChanges: PreferenceProviderDataChanges = {};
            for (const change of changes) {
                prefChanges[change.preferenceName] = change;
            }
            this.onDidPreferencesChangedEmitter.fire(prefChanges);
        } else {
            this.onDidPreferencesChangedEmitter.fire(changes);
        }
    }

    get<T>(preferenceName: string, resourceUri?: string): T | undefined {
        return this.resolve<T>(preferenceName, resourceUri).value;
    }

    resolve<T>(preferenceName: string, resourceUri?: string): PreferenceResolveResult<T> {
        const value = this.getPreferences(resourceUri)[preferenceName];
        if (value !== undefined) {
            return {
                value,
                configUri: this.getConfigUri(resourceUri),
            };
        }
        return {};
    }

    abstract getPreferences(resourceUri?: string): { [p: string]: any };

    abstract setPreference(key: string, value: any, resourceUri?: string): Promise<boolean>;

    /**
     * 返回promise，当 preference provider 已经可以提供配置时返回resolved
     */
    get ready() {
        return this._ready.promise;
    }

    /**
     * 默认返回undefined
     */
    getDomain(): string[] | undefined {
        return undefined;
    }

    /**
     * 默认返回undefined
     */
    getConfigUri(resourceUri?: string): URI | undefined {
        return undefined;
    }

    static merge(source: JSONValue | undefined, target: JSONValue): JSONValue {
        if (source === undefined || !JSONUtils.isObject(source)) {
            return JSONUtils.deepCopy(target);
        }
        if (JSONUtils.isPrimitive(target)) {
            return {};
        }
        for (const key of Object.keys(target)) {
            const value = (target as any)[key];
            if (key in source) {
                if (JSONUtils.isObject(source[key]) && JSONUtils.isObject(value)) {
                    this.merge(source[key], value);
                    continue;
                }
            }
            source[key] = JSONUtils.deepCopy(value);
        }
        return source;
    }

}
