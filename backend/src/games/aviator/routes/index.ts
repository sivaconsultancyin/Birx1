import { Router } from 'express';
import type { AviatorGameDeps } from '../game.ts';
import { registerAviatorRoutes } from './aviatorRoutes.ts';

export function createAviatorRouter(deps: AviatorGameDeps, runtime: Parameters<typeof registerAviatorRoutes>[2]) {
  const router = Router();
  const appLike = { get: router.get.bind(router), post: router.post.bind(router) } as Parameters<typeof registerAviatorRoutes>[0];
  registerAviatorRoutes(appLike, deps, runtime);
  return router;
}
