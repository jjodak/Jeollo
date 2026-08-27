import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import monthlyTempleEventsHandler from './api/monthly-temple-events.js';
import recognizeHeritageHandler from './api/recognize-heritage.js';

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

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function createVercelRequest(req, { includeBody = false } = {}) {
  return {
    method: req.method,
    query: toQueryObject(req.url),
    headers: req.headers,
    body: includeBody ? await readRequestBody(req) : undefined,
  };
}

function localApiDevRoutes() {
  return {
    name: 'jeollo-local-api-routes',
    configureServer(server) {
      server.middlewares.use('/api/monthly-temple-events', async (req, res) => {
        try {
          await monthlyTempleEventsHandler(
            await createVercelRequest(req),
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

      server.middlewares.use('/api/recognize-heritage', async (req, res) => {
        try {
          await recognizeHeritageHandler(
            await createVercelRequest(req, { includeBody: true }),
            createVercelResponse(res),
          );
        } catch (error) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            ok: false,
            match: null,
            error: error instanceof Error ? error.message : 'Recognition API failed.',
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
    plugins: [react(), localApiDevRoutes()],
  };
});
