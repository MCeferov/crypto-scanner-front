import type { Kline } from './binanceApi';

export type KlineHandler = (kline: Kline, isClosed: boolean) => void;

export class ChartKlineWebSocket {
  private ws: WebSocket | null = null;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;

  constructor(
    private symbol: string,
    private interval: string,
    private onKline: KlineHandler,
  ) {}

  connect() {
    if (this.destroyed) return;
    const stream = `${this.symbol.toLowerCase()}@kline_${this.interval}`;
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);

    this.ws.onopen = () => { this.reconnectDelay = 1000; };

    this.ws.onmessage = (event) => {
      if (this.destroyed) return;
      try {
        const msg = JSON.parse(event.data);
        const k = msg.k;
        if (!k) return;
        this.onKline({
          openTime: k.t,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          closeTime: k.T,
        }, k.x);
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
        this.connect();
      }, this.reconnectDelay);
    };
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
