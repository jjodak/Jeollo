import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import monthlyTempleEventsHandler from './api/monthly-temple-events.js';

function toQueryObject(url) {
  return Object.fromEntries(new URL(url ?? '/', 'http://localhost').searchParams.entries());
}

function createVercelResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }

      res.end(JSON.stringify(payload));
    },
  };
}

function monthlyTempleEventsDevApi() {
  return {
    name: 'monthly-temple-events-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/monthly-temple-events', async (req, res) => {
        try {
          await monthlyTempleEventsHandler(
            {
              method: req.method,
              query: toQueryObject(req.url),
            },
            createVercelResponse(res),
          );
        } catch (error) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            ok: false,
            events: [],
            error: error instanceof Error ? error.message : 'Monthly event API failed.',
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), monthlyTempleEventsDevApi()],
  };
});
