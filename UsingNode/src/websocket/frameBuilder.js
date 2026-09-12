class FrameBuilder {
  static buildFrame(opcode, payloadBuffer) {
    const length = payloadBuffer.length;
    let header;

    if (length <= 125) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | (opcode & 0x0f); // FIN bit set
      header[1] = length; // Unmasked server payload
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | (opcode & 0x0f);
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | (opcode & 0x0f);
      header[1] = 127;
      const high = Math.floor(length / 2 ** 32);
      const low = length % 2 ** 32;
      header.writeUInt32BE(high, 2);
      header.writeUInt32BE(low, 6);
    }

    return Buffer.concat([header, payloadBuffer]);
  }

  static buildTextFrame(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return this.buildFrame(0x1, Buffer.from(text, 'utf-8'));
  }

  static buildPingFrame() {
    return this.buildFrame(0x9, Buffer.alloc(0));
  }

  static buildPongFrame(payload = Buffer.alloc(0)) {
    return this.buildFrame(0xa, payload);
  }

  static buildCloseFrame(code = 1000, reason = '') {
    const reasonBuffer = Buffer.from(reason, 'utf-8');
    const payload = Buffer.alloc(2 + reasonBuffer.length);
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2);
    return this.buildFrame(0x8, payload);
  }
}

module.exports = FrameBuilder;