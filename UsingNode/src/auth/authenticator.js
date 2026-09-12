// src/auth/authenticator.js
class Authenticator {
  constructor() {
    // Simulated token table for isolated testing
    this.validTokens = new Map([
      ['token-user-1', { userId: 'U100', name: 'Alice' }],
      ['token-user-2', { userId: 'U200', name: 'Bob' }],
      ['token-user-3', { userId: 'U300', name: 'Charlie' }]
    ]);
  }

  async authenticateUpgrade(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token || !this.validTokens.has(token)) {
      throw new Error('UNAUTHORIZED: Invalid or missing authentication token');
    }

    return this.validTokens.get(token);
  }
}

module.exports = Authenticator;