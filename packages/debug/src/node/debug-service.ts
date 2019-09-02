import { Injectable, Autowired } from '@ali/common-di';
import { DebugConfiguration } from '../common/debug-configuration';
import { DebugService, DebuggerDescription } from '../common/debug-service';
import { DebugAdapterSessionManager } from './debug-adapter-session-manager';
import { DebugAdapterContributionRegistry } from './debug-adapter-contribution-registry';
import { IJSONSchema, IJSONSchemaSnippet } from '@ali/ide-core-node';

@Injectable()
export class DebugServiceImpl implements DebugService {

  @Autowired(DebugAdapterSessionManager)
  protected readonly sessionManager: DebugAdapterSessionManager;

  @Autowired(DebugAdapterContributionRegistry)
  protected readonly registry: DebugAdapterContributionRegistry;

  dispose(): void {
    this.terminateDebugSession();
  }

  async debugTypes(): Promise<string[]> {
    return this.registry.debugTypes();
  }

  getDebuggersForLanguage(language: string): Promise<DebuggerDescription[]> {
    return this.registry.getDebuggersForLanguage(language);
  }

  getSchemaAttributes(debugType: string): Promise<IJSONSchema[]> {
    return this.registry.getSchemaAttributes(debugType);
  }

  getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]> {
    return this.registry.getConfigurationSnippets();
  }

  async provideDebugConfigurations(debugType: string, workspaceFolderUri?: string): Promise<DebugConfiguration[]> {
    return this.registry.provideDebugConfigurations(debugType, workspaceFolderUri);
  }
  async resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri?: string): Promise<DebugConfiguration> {
    return this.registry.resolveDebugConfiguration(config, workspaceFolderUri);
  }

  protected readonly sessions = new Set<string>();
  async createDebugSession(config: DebugConfiguration): Promise<string> {
    const session = await this.sessionManager.create(config, this.registry);
    this.sessions.add(session.id);
    return session.id;
  }

  async terminateDebugSession(sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.doStop(sessionId);
    } else {
      const promises: Promise<void>[] = [];
      const sessions = [...this.sessions];
      this.sessions.clear();
      for (const session of sessions) {
        promises.push((async () => {
          try {
            await this.doStop(session);
          } catch (e) {
            console.error(e);
          }
        })());
      }
      await Promise.all(promises);
    }
  }
  protected async doStop(sessionId: string): Promise<void> {
    const debugSession = this.sessionManager.find(sessionId);
    if (debugSession) {
      this.sessionManager.remove(sessionId);
      this.sessions.delete(sessionId);
      await debugSession.stop();
    }
  }

}
