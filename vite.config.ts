import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_FILE = path.resolve(__dirname, 'src/data/locations.json');

async function readLocations(): Promise<unknown[]> {
  try {
    const raw = await fs.readFile(LOCATIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocations(list: unknown[]): Promise<void> {
  await fs.writeFile(LOCATIONS_FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
}

function readJsonBody(req: import('http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function locationsApiPlugin(): Plugin {
  return {
    name: 'locations-api',
    configureServer(server) {
      server.middlewares.use('/api/locations', async (req, res, next) => {
        if (req.method === 'GET') {
          const list = await readLocations();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(list));
          return;
        }
        if (req.method === 'POST') {
          try {
            const loc = (await readJsonBody(req)) as Record<string, unknown>;
            const list = await readLocations();
            list.push(loc);
            await writeLocations(list);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, count: list.length }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }
        if (req.method === 'DELETE') {
          try {
            const { id } = (await readJsonBody(req)) as { id?: string };
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'missing id' }));
              return;
            }
            const list = await readLocations();
            const filtered = (list as Array<{ id: string }>).filter((l) => l.id !== id);
            await writeLocations(filtered);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, count: filtered.length }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), locationsApiPlugin()],
  server: {
    port: 5173,
  },
});
