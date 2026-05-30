import { Request, Response, NextFunction } from "express";
import { RedisIdempotencyStore, IdempotencyStore } from "./index";

type Options = {
  headerName?: string;
  redisUrl?: string | null;
  ttlMs?: number;
};

export function createIdempotencyMiddleware(options: Options = {}) {
  const header = options.headerName || "Idempotency-Key";
  const store = options.redisUrl
    ? new RedisIdempotencyStore(options.redisUrl, options.ttlMs)
    : new IdempotencyStore();

  return async function idempotency(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const key = req.header(header);
    if (!key) return next();

    try {
      const exists = await store.check(key);
      if (exists) {
        const prev = await store.getResult(key);
        if (prev) return res.status(200).json(prev);
      }

      // capture response
      const originalSend = res.send.bind(res);
      let bodyBuffer: any = null;
      res.send = (body?: any) => {
        bodyBuffer = body;
        return originalSend(body);
      };

      res.once("finish", async () => {
        try {
          // only store successful responses
          if (res.statusCode >= 200 && res.statusCode < 300 && key) {
            let parsed = bodyBuffer;
            try {
              parsed =
                typeof bodyBuffer === "string"
                  ? JSON.parse(bodyBuffer)
                  : bodyBuffer;
            } catch {}
            await store.store(key, parsed);
          }
        } catch (err) {
          console.error("Failed to store idempotency result", err);
        }
      });

      next();
    } catch (err) {
      console.error("Idempotency middleware error", err);
      next();
    }
  };
}
