const createHttpServer = require('./server/httpServer');
const ConnectionManager = require('./server/connectionManager');
const WebSocketServer = require('./websocket/websocketServer');
const Authenticator = require('./auth/authenticator');
const AuthorizationService = require('./auth/authorization');
const UserRepository = require('./persistence/userRepository');
const MessageRepository = require('./persistence/messageRepository');
const GroupRepository = require('./persistence/groupRepository');
const RoutingService = require('./chat/routingService');
const MessageService = require('./chat/messageService');
const GroupService = require('./chat/groupService');
const ReadReceiptService = require('./chat/readReceiptService');
const MinimalRedisClient = require('./realtime/redisClient');
const EventPublisher = require('./realtime/eventPublisher');
const EventSubscriber = require('./realtime/eventSubscriber');
const PresenceRegistry = require('./realtime/presenceRegistry');
const config = require('./config');

async function initializeApp() {
  console.log(`[Init] Starting Node instance: ${config.NODE_ID} on port ${config.PORT}`);

  // 1. Repositories
  const userRepo = new UserRepository();
  const messageRepo = new MessageRepository();
  const groupRepo = new GroupRepository();

  // 2. Services
  const connectionManager = new ConnectionManager();
  const routingService = new RoutingService(connectionManager);
  const authService = new AuthorizationService(groupRepo);
  const authenticator = new Authenticator();

  // 3. Redis Setup
  let publisher = null;
  let presenceRegistry = null;

  try {
    const redisPubClient = new MinimalRedisClient();
    const redisSubClient = new MinimalRedisClient();

    await redisPubClient.connect();
    await redisSubClient.connect();

    publisher = new EventPublisher(redisPubClient, config.NODE_ID);
    const subscriber = new EventSubscriber(redisSubClient, config.NODE_ID, routingService);
    subscriber.subscribe();

    presenceRegistry = new PresenceRegistry(redisPubClient, config.NODE_ID);
    console.log('[Init] Redis pub/sub integration enabled');
  } catch (err) {
    console.warn('[Init] Redis connection failed. Operating in single-node standalone mode:', err.message);
  }

  // 4. Domain Services
  const messageService = new MessageService(messageRepo, routingService, authService, publisher);
  const groupService = new GroupService(groupRepo, messageRepo, routingService, authService, publisher);
  const readReceiptService = new ReadReceiptService(messageRepo, routingService, publisher);

  // 5. WebSocket Server
  const wsServer = new WebSocketServer(
    authenticator,
    connectionManager,
    messageService,
    groupService,
    readReceiptService,
    presenceRegistry
  );
  wsServer.init();

  // 6. HTTP Server
  const httpServer = createHttpServer((req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head);
  });

  return { httpServer, wsServer, presenceRegistry };
}

module.exports = initializeApp;