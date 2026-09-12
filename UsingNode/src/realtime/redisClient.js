const net = require('net');
const EventEmitter = require('events');

class MinimalRedisClient extends EventEmitter {
  constructor(host = '127.0.0.1', port = 6379) {
    super();
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
    this.buffer = Buffer.alloc(0);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        this.connected = true;
        this.emit('connect');
        resolve();
      });

      this.socket.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.parseRESP();
      });

      this.socket.on('error', (err) => {
        // If we haven't connected yet, let the promise rejection handle it cleanly
        if (!this.connected) {
          reject(err);
        } else {
          // Emitting 'error' after connection only if listeners exist
          if (this.listenerCount('error') > 0) {
            this.emit('error', err);
          }
        }
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('close');
      });
    });
  }

  sendCommand(args) {
    if (!this.connected) throw new Error('Redis client disconnected');
    let command = `*${args.length}\r\n`;
    for (const arg of args) {
      const str = String(arg);
      command += `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
    }
    this.socket.write(command);
  }

  parseRESP() {
    while (this.buffer.length > 0) {
      const str = this.buffer.toString('utf-8');
      const newlineIdx = str.indexOf('\r\n');
      if (newlineIdx === -1) return;

      const type = str[0];
      if (type === '*') {
        const count = parseInt(str.substring(1, newlineIdx), 10);
        let currentPos = newlineIdx + 2;
        const elements = [];
        let parsedAll = true;

        for (let i = 0; i < count; i++) {
          if (currentPos >= this.buffer.length) {
            parsedAll = false;
            break;
          }
          const nextNewline = str.indexOf('\r\n', currentPos);
          if (nextNewline === -1) {
            parsedAll = false;
            break;
          }
          const len = parseInt(str.substring(currentPos + 1, nextNewline), 10);
          const valStart = nextNewline + 2;
          const valEnd = valStart + len;
          if (valEnd > this.buffer.length) {
            parsedAll = false;
            break;
          }
          elements.push(str.substring(valStart, valEnd));
          currentPos = valEnd + 2;
        }

        if (parsedAll) {
          this.buffer = this.buffer.subarray(currentPos);
          if (elements[0] === 'message') {
            this.emit('message', { channel: elements[1], payload: elements[2] });
          }
        } else {
          return;
        }
      } else {
        this.buffer = this.buffer.subarray(newlineIdx + 2);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

module.exports = MinimalRedisClient;