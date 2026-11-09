import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '@/config/env';
import { createRedisClient } from '@/infra/redis/redis.client';
import { logger } from '@/common/utils/logger';

logger.info('🚀 Initializing Needs Realtime Server (Socket.IO + Redis Adapter)...');

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      service: 'needs-realtime',
      status: 'UP',
      timestamp: new Date().toISOString(),
    })
  );
});

// Redis pub/sub clients for horizontal scaling
const pubClient = createRedisClient();
const subClient = createRedisClient();

const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN.includes(',')
      ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  adapter: createAdapter(pubClient, subClient),
});

// Register specialized real-time gateways
import { registerTrackingGateway } from './tracking.gateway';
import { registerChatGateway } from './chat.gateway';

registerTrackingGateway(io);
registerChatGateway(io);

// Foundational Socket connection lifecycle
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected to realtime server');

  socket.on('ping', (cb) => {
    if (typeof cb === 'function') {
      cb({ status: 'pong', timestamp: Date.now() });
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason }, 'Client disconnected from realtime server');
  });
});

const PORT = env.SOCKET_PORT || 4001;

server.listen(PORT, () => {
  logger.info({ port: PORT }, `✅ Needs Realtime Socket.IO server listening on port ${PORT}`);
});

// Graceful shutdown handling
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown initiated for Realtime Server');

  io.close(() => {
    logger.info('Socket.IO server closed');
  });

  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await Promise.all([pubClient.quit(), subClient.quit()]);
      logger.info('Redis adapter clients closed');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error closing Redis adapter clients');
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { io, server };
