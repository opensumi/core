import { writeFile } from 'fs-extra';
import { ProfilingSession, Profile } from 'v8-inspect-profiler';

import { Injectable, Autowired } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node/lib/logger/node-logger';

import { IExtensionHostProfilerService, IExtensionNodeService } from '../common';

export enum ProfileSessionState {
  None = 0,
  Starting = 1,
  Running = 2,
  Stopping = 3,
}

@Injectable()
export class ExtensionProfilerService implements IExtensionHostProfilerService {
  @Autowired(IExtensionNodeService)
  private extensionService: IExtensionNodeService;

  @Autowired(INodeLogger)
  logger: INodeLogger;

  private sessionMap: Map<string, ProfilingSession> = new Map();

  private lastProfile: Profile | null;

  async $startProfile(clientId: string): Promise<void> {
    this.logger.verbose(`Try enable inspect port for ${clientId}`);
    const enabled = await this.extensionService.tryEnableInspectPort(clientId);
    if (enabled) {
      const inspectPort = await this.extensionService.getProcessInspectPort(clientId);
      if (inspectPort && typeof inspectPort === 'number') {
        const session = await this.doStartProfiler(inspectPort);
        this.sessionMap.set(clientId, session);
      }
    }
  }

  private async doStartProfiler(port: number): Promise<ProfilingSession> {
    const profiler = await import('v8-inspect-profiler');
    const session = await profiler.startProfiling({ port, checkForPaused: true });
    return {
      stop: async () => {
        const profile = await session.stop();
        return profile;
      },
    };
  }

  async $stopProfile(clientId: string): Promise<boolean> {
    if (!this.sessionMap.has(clientId)) {
      this.logger.verbose(`No ${clientId} profiling session found.`);
      return false;
    }

    this.logger.verbose(`find ${clientId} session, stop...`);
    const session = this.sessionMap.get(clientId);
    try {
      const profileResult = await session?.stop();
      if (profileResult) {
        this.lastProfile = profileResult.profile;
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error(`Stop profiling session fail, reason: \n ${err.message || err}`);
      return false;
    }
  }

  async $saveLastProfile(savePath: string): Promise<void> {
    await writeFile(savePath, JSON.stringify(this.lastProfile ? this.lastProfile : {}, null, '\t'));
    this.lastProfile = null;
  }
}
