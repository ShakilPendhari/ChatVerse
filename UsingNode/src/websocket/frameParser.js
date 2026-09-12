const EventEmitter = require('events');
const config = require('../config');

class FrameParser extends EventEmitter {
  constructor() {
    super();
    this.buffer = Buffer.alloc(0);
  }

  addChunk(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.parse();
  }

  parse() {
    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const secondByte = this.buffer[1];

      const fin = (firstByte & 0x80) === 0x80;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) === 0x80;
      let payloadLength = secondByte & 0x7f;

      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < 4) return; // Wait for full header
        payloadLength = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) return; // Wait for full header
        const high = this.buffer.readUInt32BE(2);
        const low = this.buffer.readUInt32BE(6);
        payloadLength = high * 2 ** 32 + low;
        offset = 10;
      }

      if (payloadLength > config.MAX_FRAME_SIZE) {
        this.emit('error', new Error(`Frame payload size ${payloadLength} exceeds maximum allowed size`));
        return;
      }

      let maskingKey = null;
      if (masked) {
        if (this.buffer.length < offset + 4) return; // Wait for key
        maskingKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const totalFrameLength = offset + payloadLength;
      if (this.buffer.length < totalFrameLength) return; // Wait for full payload

      let payload = this.buffer.subarray(offset, totalFrameLength);

      if (masked && maskingKey) {
        payload = Buffer.alloc(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
          payload[i] = this.buffer[offset + i] ^ maskingKey[i % 4];
        }
      }

      // Consume frame bytes from internal accumulator
      this.buffer = this.buffer.subarray(totalFrameLength);

      this.emit('frame', { fin, opcode, payload });
    }
  }
}

module.exports = FrameParser;