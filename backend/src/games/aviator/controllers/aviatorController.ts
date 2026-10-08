import type { Request, Response } from 'express';
import type { AviatorGameDeps } from '../game.ts';

export interface AviatorControllerRuntime {
  getFairness(res: Response): Promise<void> | void;
  getState(req: Request, res: Response): Promise<void>;
  placeBet(req: Request, res: Response): Promise<void>;
  cashOut(req: Request, res: Response): Promise<void>;
}

export function createAviatorController(runtime: AviatorControllerRuntime) {
  return runtime;
}
