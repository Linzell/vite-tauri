import ws from 'ws';
import http from 'http';
import * as map from 'lib0/map';

let wss: ws.Server;
let server: http.Server;

// Start yjs masternode
async function start(): Promise<string> {
  const { logger } = await import('@libp2p/logger');

  const log = logger('i2kn:api:yjs');

  const wsReadyStateConnecting = 0;
  const wsReadyStateOpen = 1;
  // const wsReadyStateClosing = 2;
  // const wsReadyStateClosed = 3;
  const pingTimeout = 30000;
  const port = process.env.PORT || 4444;
  wss = new ws.Server({ noServer: true });
  server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('okay');
  });

  const topics = new Map();

  const send = (conn, message) => {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
      conn.close();
    }
    try {
      conn.send(JSON.stringify(message));
      log('send : %o', message);
    } catch (e) {
      conn.close();
    }
  };

  const onconnection = async (conn) => {
    /**
     * @type {Set<string>}
     */
    const uint8ArrayToString = (await import('uint8arrays/to-string')).toString;

    const subscribedTopics = new Set();
    let closed = false;
    // Check if connection is still alive
    let pongReceived = true;
    const pingInterval = setInterval(() => {
      if (!pongReceived) {
        conn.close();
        clearInterval(pingInterval);
      } else {
        pongReceived = false;
        try {
          conn.ping();
        } catch (e) {
          conn.close();
        }
      }
    }, pingTimeout);
    conn.on('pong', () => {
      log('pong');
      pongReceived = true;
    });
    conn.on('close', () => {
      log('close');
      subscribedTopics.forEach((topicName) => {
        const subs = topics.get(topicName) || new Set();
        subs.delete(conn);
        if (subs.size === 0) {
          topics.delete(topicName);
        }
      });
      subscribedTopics.clear();
      closed = true;
    });
    conn.on('message', /** @param {object} message */ (message) => {
      log('message %o', uint8ArrayToString(message));
      if (typeof message === 'string') {
        message = JSON.parse(message);
      }
      if (message && message.type && !closed) {
        switch (message.type) {
          case 'subscribe':
            (message.topics || []).forEach((topicName) => {
              if (typeof topicName === 'string') {
                // add conn to topic
                const topic = map.setIfUndefined(topics, topicName, () => new Set());
                topic.add(conn);
                // add topic to conn
                subscribedTopics.add(topicName);
              }
            });
            break;
          case 'unsubscribe':
            (message.topics || []).forEach((topicName) => {
              const subs = topics.get(topicName);
              if (subs) {
                subs.delete(conn);
              }
            });
            break;
          case 'publish':
            if (message.topic) {
              const receivers = topics.get(message.topic);
              if (receivers) {
                receivers.forEach((receiver) => send(receiver, message));
              }
            }
            break;
          case 'ping':
            send(conn, { type: 'pong' });
            break;
          default:
        }
      }
    });
  };

  wss.on('connection', onconnection);

  server.on('upgrade', (request, socket, head) => {
    log('upgrade');
    const handleAuth = (hws) => {
      wss.emit('connection', hws, request);
    };
    wss.handleUpgrade(request, socket, head, handleAuth);
  });

  server.listen(port);
  log('yjs started');

  return 'masternode started'; // IP:port !
}

async function stop(): Promise<string> {
  wss.close();
  server.close();
  return 'stopped';
}

export const yjs = {
  start,
  stop,
};
