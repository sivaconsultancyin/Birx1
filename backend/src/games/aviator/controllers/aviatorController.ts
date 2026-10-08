import type { Request, Response } from 'express';
export interface AviatorControllerRuntime {
  getFairness(res: Response): Promise<void> | void;
  getState(req: Request, res: Response): Promise<void>;
  placeBet(req: Request, res: Response): Promise<void>;
  cashOut(req: Request, res: Response): Promise<void>;
}

export function createAviatorController(runtime: AviatorControllerRuntime) {
  return runtime;
}
