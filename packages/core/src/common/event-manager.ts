type EventHandler<T extends any[] = any[], K = any> = (...args: T) => K;

export class EventManager {
  private map = new Map<string, EventHandler>();

  register(eventName: string, fn: EventHandler) {
    if (this.map.has(eventName)) {
      throw new Error(`The eventName: "${eventName}" has been register yet.`);
    }

    this.map.set(eventName, fn);
    return () => this.map.delete(eventName);
  }

  getHandler(eventName: string) {
    return this.map.get(eventName);
  }

  handle<T extends any[] = any[], K = any>(eventName: string, args: T): K {
    const fn = this.getHandler(eventName);
    if (!fn) {
      throw new Error(`Can't find handler for ${eventName}.`);
    }

    return fn(...args);
  }
}
