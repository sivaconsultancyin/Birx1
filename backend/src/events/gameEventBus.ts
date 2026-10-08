import { EventEmitter } from 'node:events';

export type GameEventPayload = Record<string, unknown>;

export interface GameEvent {
  type: string;
  data: GameEventPayload;
  timestamp: number;
}

type AnyListener = (event: GameEvent) => void;

export class GameEventBus {
  private readonly emitter = new EventEmitter();
  private readonly anyListeners = new Set<AnyListener>();

  emit(type: string, data: GameEventPayload = {}): GameEvent {
    const event: GameEvent = {
      type,
      data,
      timestamp: Date.now()
    };

    this.emitter.emit(type, event);
    for (const listener of this.anyListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[EventBus] listener failed for ${type}:`, error);
      }
    }

    return event;
  }

  on(type: string, listener: AnyListener): () => void {
    this.emitter.on(type, listener);
    return () => this.emitter.off(type, listener);
  }

  onAny(listener: AnyListener): () => void {
    this.anyListeners.add(listener);
    return () => this.anyListeners.delete(listener);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.anyListeners.clear();
  }
}

export const gameEventBus = new GameEventBus();
