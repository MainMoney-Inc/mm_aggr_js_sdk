/** Tiny event bus. Do not log secrets or poll headers. */

export type Listener<T> = (payload: T) => void;

export class Emitter {
  private readonly listeners = new Map<string, Set<Listener<unknown>>>();

  on<T>(event: string, listener: Listener<T>): () => void {
    let bucket = this.listeners.get(event);
    if (bucket === undefined) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<T>(event: string, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<T>(event: string, payload: T): void {
    const bucket = this.listeners.get(event);
    if (bucket === undefined) {
      return;
    }
    for (const listener of bucket) {
      listener(payload);
    }
  }
}
