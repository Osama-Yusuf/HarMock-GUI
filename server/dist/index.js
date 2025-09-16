#!/usr/bin/env node
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
// removed dev-time fastify http proxy; use Vite proxy instead
import { apiRoutes } from './routes/api.js';
import { mockRoutes } from './routes/mock.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 });
await app.register(cors, { origin: true, exposedHeaders: ['x-mock-session'] });
await apiRoutes(app);
await mockRoutes(app);
// Frontend: in prod serve static build (dev served by Vite directly)
const DEV = process.env.DEV_PROXY === '1';
if (!DEV) {
    const dist = path.resolve(__dirname, '../../web/dist');
    await app.register(fastifyStatic, { root: dist, index: ['index.html'] });
    app.get('/*', (_req, reply) => reply.sendFile('index.html'));
}
const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).then(() => {
    console.log(`🚀 Harmock running on http://localhost:${port}`);
    console.log(`📁 Upload HAR files and create mock APIs instantly!`);
});
