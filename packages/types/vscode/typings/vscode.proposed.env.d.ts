declare module 'vscode' {
  /**
     * A special value wrapper denoting a value that is safe to not clean.
     * This is to be used when you can guarantee no identifiable information is contained in the value and the cleaning is improperly redacting it.
     */
  export class TelemetryTrustedValue<T = any> {
    readonly value: T;

    constructor(value: T);
}

/**
 * A telemetry logger which can be used by extensions to log usage and error telemetry.
 *
 * A logger wraps around a {@link TelemetrySender sender} but it guarantees that
 * - user settings to disable or tweak telemetry are respected, and that
 * - potential sensitive data is removed
 *
 * It also enables an "echo UI" that prints whatever data is send and it allows the editor
 * to forward unhandled errors to the respective extensions.
 *
 * To get an instance of a `TelemetryLogger`, use
 * {@link env.createTelemetryLogger `createTelemetryLogger`}.
 */
export interface TelemetryLogger {

    /**
     * An {@link Event} which fires when the enablement state of usage or error telemetry changes.
     */
    readonly onDidChangeEnableStates: Event<TelemetryLogger>;

    /**
     * Whether or not usage telemetry is enabled for this logger.
     */
    readonly isUsageEnabled: boolean;

    /**
     * Whether or not error telemetry is enabled for this logger.
     */
    readonly isErrorsEnabled: boolean;

    /**
     * Log a usage event.
     *
     * After completing cleaning, telemetry setting checks, and data mix-in calls `TelemetrySender.sendEventData` to log the event.
     * Automatically supports echoing to extension telemetry output channel.
     * @param eventName The event name to log
     * @param data The data to log
     */
    logUsage(eventName: string, data?: Record<string, any | TelemetryTrustedValue>): void;

    /**
     * Log an error event.
     *
     * After completing cleaning, telemetry setting checks, and data mix-in calls `TelemetrySender.sendEventData` to log the event. Differs from `logUsage` in that it will log the event if the telemetry setting is Error+.
     * Automatically supports echoing to extension telemetry output channel.
     * @param eventName The event name to log
     * @param data The data to log
     */
    logError(eventName: string, data?: Record<string, any | TelemetryTrustedValue>): void;

    /**
     * Log an error event.
     *
     * Calls `TelemetrySender.sendErrorData`. Does cleaning, telemetry checks, and data mix-in.
     * Automatically supports echoing to extension telemetry output channel.
     * Will also automatically log any exceptions thrown within the extension host process.
     * @param error The error object which contains the stack trace cleaned of PII
     * @param data Additional data to log alongside the stack trace
     */
    logError(error: Error, data?: Record<string, any | TelemetryTrustedValue>): void;

    /**
     * Dispose this object and free resources.
     */
    dispose(): void;
  }
}
