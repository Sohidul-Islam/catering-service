// Polyfill WebSocket for Node.js v18 Supabase Realtime client checks
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor() {}
  } as any;
}
