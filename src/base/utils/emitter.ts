/** Obtain the parameters of a function type in a tuple */
type Params<T extends (...args: any) => any> = T extends (
  ...args: infer P extends any[]
) => any
  ? P
  : [];

type EmitterEvents = {
  [key: string]: (...args: any) => void;
};

export class Emitter<E extends EmitterEvents> {
  private listeners = new Map<keyof E, Array<(...args: any) => void>>();

  on<K extends keyof E>(event: K, listener: E[K]) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  off<K extends keyof E>(event: K, listener: E[K]) {
    const listeners = this.listeners.get(event) ?? [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    this.listeners.set(event, listeners);
  }

  emit<K extends keyof E>(event: K, ...args: Params<E[K]>) {
    const listeners = this.listeners.get(event) ?? [];
    for (const listener of listeners.slice()) {
      setTimeout(() => {
        listener.apply(null, args);
      });
    }
  }

  emitImmediate<K extends keyof E>(event: K, ...args: Params<E[K]>) {
    const listeners = this.listeners.get(event) ?? [];
    for (const listener of listeners.slice()) {
      listener.apply(null, args);
    }
  }
}
