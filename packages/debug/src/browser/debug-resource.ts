import { Injectable, Autowired } from '@ali/common-di';
import { DebugSessionManager } from './debug-session-manager';
import { DebugSource } from './model/debug-source';
import { URI, ResourceResolverContribution, Resource, Domain } from '@ali/ide-core-browser';

export class DebugResource implements Resource {

    constructor(
        public uri: URI,
        protected readonly manager: DebugSessionManager,
    ) { }

    dispose(): void { }

    async readContents(): Promise<string> {
        const { currentSession } = this.manager;
        if (!currentSession) {
            throw new Error(`There is no active debug session to load content '${this.uri}'`);
        }
        const source = await currentSession.toSource(this.uri);
        if (!source) {
            throw new Error(`There is no source for '${this.uri}'`);
        }
        return source.load();
    }

}

@Domain(ResourceResolverContribution)
export class DebugResourceResolverContribution implements ResourceResolverContribution {

    @Autowired(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    resolve(uri: URI): DebugResource {
        if (uri.scheme !== DebugSource.SCHEME) {
            throw new Error('The given URI is not a valid debug URI: ' + uri);
        }
        return new DebugResource(uri, this.manager);
    }

}
