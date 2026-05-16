import Fastify from 'fastify';
import { loadStore, resolveToken, routinesForUser, recordExecution } from './store.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';

const app = Fastify({ logger: { level: 'info' } });

app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/healthz') {
    return;
  }
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const store = loadStore();
  const record = resolveToken(store, token);
  if (!record) {
    reply.code(401).send({ error: 'unauthorized', message: 'Missing or invalid bearer token' });
    return reply;
  }
  req.user_id = record.user_id;
});

app.get('/healthz', async () => ({ ok: true }));

app.get('/v1/routines', async (req) => {
  const store = loadStore();
  const routines = routinesForUser(store, req.user_id).map(({ id, name, description }) => ({ id, name, description }));
  return { routines };
});

app.post('/v1/routines/:id/execute', async (req, reply) => {
  const { id } = req.params;
  const store = loadStore();
  const routine = routinesForUser(store, req.user_id).find(r => r.id === id);
  if (!routine) {
    reply.code(404);
    return { error: 'not_found', message: `Routine ${id} not found for this user` };
  }
  recordExecution(store, { userId: req.user_id, routineId: id });
  app.log.info({ user_id: req.user_id, routine_id: id }, 'routine executed');
  reply.code(202);
  return { accepted: true, routine_id: id };
});

app.listen({ port: PORT, host: HOST }).then(() => {
  app.log.info(`mock Tethral API listening on http://${HOST}:${PORT}`);
  app.log.info('run: npm run mint-token  -> to issue a dev token');
});
