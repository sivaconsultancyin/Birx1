import type { Request, Response } from 'express';
import type { AviatorGameDeps } from '../game.ts';

export function registerAviatorRoutes(app: any, deps: AviatorGameDeps, runtime: any) {
  const { requireAuth, requirePlayerForGames } = deps;
  const { getFairness, getState, placeBet, cashOut } = runtime;
  app.get('/api/aviator/fairness', async (_req: Request, res: Response) => getFairness(res));
  app.get('/api/aviator/state', async (req: Request, res: Response) => getState(req, res));
  app.post('/api/aviator/bet', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => placeBet(req, res));
  app.post('/api/aviator/cashout', requireAuth, requirePlayerForGames, async (req: Request, res: Response) => cashOut(req, res));
}
