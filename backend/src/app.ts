import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './lib/logger';
import { registerRoutes } from './routes/index';

export async function buildApp() {
  const app = Fastify({
    logger: false, // Using pino directly via lib/logger
  });

  // CORS — allow local webui during development
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  // Log every request
  app.addHook('onRequest', (req, _reply, done) => {
    req.startTime = Date.now();
    logger.info({ method: req.method, url: req.url }, '→ Request');
    done();
  });

  app.addHook('onResponse', (req, reply, done) => {
    const duration = Date.now() - (req.startTime ?? Date.now());
    logger.info(
      { method: req.method, url: req.url, status: reply.statusCode, durationMs: duration },
      '← Response',
    );
    done();
  });

  await registerRoutes(app);

  return app;
}

// Extend Fastify request type for startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}
