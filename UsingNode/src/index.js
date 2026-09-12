const initializeApp = require('./app');
const config = require('./config');

async function main() {
  const { httpServer, wsServer, presenceRegistry } = await initializeApp();

  httpServer.listen(config.PORT, () => {
    console.log(`[Server] Listening on http://localhost:${config.PORT}`);
  });

  async function gracefulShutdown(signal) {
    console.log(`\n[Shutdown] ${signal} received. Initiating graceful teardown...`);

    httpServer.close(() => {
      console.log('[Shutdown] HTTP server closed');
    });

    wsServer.stop();

    if (presenceRegistry) {
      await presenceRegistry.clearNodePresence();
    }

    console.log('[Shutdown] Teardown complete. Exiting.');
    process.exit(0);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Fatal] Application boot failed:', err);
  process.exit(1);
});