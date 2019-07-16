import { Injectable } from '@ali/common-di';
import { Emitter, IDisposable, Disposable } from '@ali/ide-core-common';
import debounce = require('lodash.debounce');

export interface JsonSchemaConfiguration {
    url: string;
    fileMatch: string[];
}

@Injectable()
export class JsonSchemaStore {

    private _schemas: JsonSchemaConfiguration[] = [];

    protected readonly onSchemasChangedEmitter = new Emitter<void>();
    readonly onSchemasChanged = this.onSchemasChangedEmitter.event;

    protected notifyChanged = debounce(() => {
        this.onSchemasChangedEmitter.fire(undefined);
    }, 500) as any;

    registerSchema(config: JsonSchemaConfiguration): IDisposable {
        this._schemas.push(config);
        this.notifyChanged();
        return Disposable.create(() => {
            const idx = this._schemas.indexOf(config);
            if (idx > -1) {
                this._schemas.splice(idx, 1);
                this.notifyChanged();
            }
        });
    }

    getJsonSchemaConfigurations(): JsonSchemaConfiguration[] {
        return [ ...this._schemas];
    }

}
