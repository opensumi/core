import { DebugConfiguration } from '../common';

export interface DebugSessionOptions {
    configuration: DebugConfiguration;
    workspaceFolderUri?: string;
}
export interface InternalDebugSessionOptions extends DebugSessionOptions {
    id: number;
}
export namespace InternalDebugSessionOptions {
    export function is(options: DebugSessionOptions): options is InternalDebugSessionOptions {
        return ('id' in options);
    }
}
