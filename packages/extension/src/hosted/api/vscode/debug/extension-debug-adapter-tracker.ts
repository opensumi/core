import type vscode from 'vscode';

export class ExtensionDebugAdapterTracker implements vscode.DebugAdapterTracker {
  constructor(protected readonly trackers: vscode.DebugAdapterTracker[]) {}

  static async create(
    session: vscode.DebugSession,
    trackerFactories: [string, vscode.DebugAdapterTrackerFactory][],
  ): Promise<ExtensionDebugAdapterTracker> {
    const trackers: vscode.DebugAdapterTracker[] = [];

    const factories = trackerFactories
      .filter((tuple) => tuple[0] === '*' || tuple[0] === session.type)
      .map((tuple) => tuple[1]);
    for (const factory of factories) {
      const tracker = await factory.createDebugAdapterTracker(session);
      if (tracker) {
        trackers.push(tracker);
      }
    }

    return new ExtensionDebugAdapterTracker(trackers);
  }

  private toDebugProtocolMessage(message: any): vscode.DebugProtocolMessage {
    if (typeof message === 'string') {
      try {
        return JSON.parse(message);
      } catch (error) {}
    }
    return message;
  }

  onWillStartSession(): void {
    this.trackers.forEach((tracker) => {
      if (tracker.onWillStartSession) {
        tracker.onWillStartSession();
      }
    });
  }

  onWillReceiveMessage(message: any): void {
    this.trackers.forEach((tracker) => {
      if (tracker.onWillReceiveMessage) {
        tracker.onWillReceiveMessage(this.toDebugProtocolMessage(message));
      }
    });
  }

  onDidSendMessage(message: any): void {
    this.trackers.forEach((tracker) => {
      if (tracker.onDidSendMessage) {
        tracker.onDidSendMessage(this.toDebugProtocolMessage(message));
      }
    });
  }

  onWillStopSession(): void {
    this.trackers.forEach((tracker) => {
      if (tracker.onWillStopSession) {
        tracker.onWillStopSession();
      }
    });
  }

  onError(error: Error): void {
    this.trackers.forEach((tracker) => {
      if (tracker.onError) {
        tracker.onError(error);
      }
    });
  }

  onExit(code: number | undefined, signal: string | undefined): void {
    this.trackers.forEach((tracker) => {
      if (tracker.onExit) {
        tracker.onExit(code, signal);
      }
    });
  }
}
