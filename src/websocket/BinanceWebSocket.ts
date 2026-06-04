export type TickerUpdate = {
  symbol: string;
  close: string;
  open: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  change: string;
  changePercent: string;
};

type MessageHandler = (updates: TickerUpdate[]) => void;
type StatusHandler = (connected: boolean, reconnecting: boolean) => void;

export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private destroyed = false;
  private onMessage: MessageHandler;
  private onStatus: StatusHandler;
  private pendingUpdates: Map<string, TickerUpdate> = new Map();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(onMessage: MessageHandler, onStatus: StatusHandler) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus(false, true);
    try {
      // Use the all market mini tickers stream
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

      this.ws.onopen = () => {
        if (this.destroyed) { this.ws?.close(); return; }
        this.reconnectDelay = 1000;
        this.onStatus(true, false);
        this.startFlushTimer();
      };

      this.ws.onmessage = (event) => {
        if (this.destroyed) return;
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            data.forEach((tick: any) => {
              if (!tick.s || !tick.s.endsWith('USDT')) return;
              const prevClose = parseFloat(tick.o);
              const currentClose = parseFloat(tick.c);
              const change = currentClose - prevClose;
              const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
              this.pendingUpdates.set(tick.s, {
                symbol: tick.s,
                close: tick.c,
                open: tick.o,
                high: tick.h,
                low: tick.l,
                volume: tick.v,
                quoteVolume: tick.q,
                change: change.toString(),
                changePercent: changePercent.toFixed(4),
              });
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        if (this.destroyed) return;
        this.onStatus(false, true);
        this.stopFlushTimer();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        if (this.destroyed) return;
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      if (this.pendingUpdates.size === 0) return;
      const updates = Array.from(this.pendingUpdates.values());
      this.pendingUpdates.clear();
      this.onMessage(updates);
    }, 1000); // flush updates every 1 second
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  destroy() {
    this.destroyed = true;
    this.stopFlushTimer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
