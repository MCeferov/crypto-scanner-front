import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import type { IChartApi, ISeriesApi, SeriesType, MouseEventParams, Time, Logical } from 'lightweight-charts';
import type { Kline } from '../../../services/binanceApi';
import type { ChartZone } from '../../../indicators/chartZones';
import type { ChartPattern } from '../../../indicators/patterns';
import {
  type Drawing, type DrawingPoint, type DrawingTool,
  DRAWING_COLOR, DRAWING_SELECTED_COLOR, RULER_FILL, RULER_BG,
  SUPPLY_FILL, SUPPLY_BORDER, DEMAND_FILL, DEMAND_BORDER,
} from './drawingTypes';

/*
 * Custom canvas drawing layer — lightweight-charts native drawing dəstəkləmir.
 *
 * Nöqtələr {time, price} kimi saxlanır və hər frame-də cari scale-ə görə
 * ekran koordinatına çevrilir → zoom/pan/resize zamanı pozulmur.
 * X çevrilməsi uniform bar grid üzərindən logical index ilə aparılır ki,
 * görünən diapazondan kənar nöqtələr də düzgün proyeksiya olunsun.
 */

export interface DrawingLayerHandle {
  deleteSelected: () => void;
  clearAll: () => void;
}

interface DrawingLayerProps {
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<SeriesType> | null>;
  klinesRef: React.RefObject<Kline[]>;
  /** Supertrend area fill üçün: {time(sec), value, trend} */
  stDataRef: React.RefObject<{ time: number; value: number; trend: 1 | -1 }[]>;
  zones: ChartZone[];
  patterns: ChartPattern[];
  tool: DrawingTool;
  onToolFinished: () => void;
  magnet: boolean;
  drawingsVisible: boolean;
  onSelectionChange: (hasSelection: boolean) => void;
}

interface TextDraft {
  x: number;
  y: number;
  point: DrawingPoint;
}

let idCounter = 0;
const nextId = () => `dw-${++idCounter}`;

const HIT_TOLERANCE = 7;
const MAGNET_TOLERANCE_PX = 10;

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const DrawingLayer = forwardRef<DrawingLayerHandle, DrawingLayerProps>(function DrawingLayer(
  {
    chartRef, seriesRef, klinesRef, stDataRef, zones, patterns,
    tool, onToolFinished, magnet, drawingsVisible, onSelectionChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingsRef = useRef<Drawing[]>([]);
  const draftRef = useRef<Drawing | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  /** İki-nöqtəli alət: 1-ci klik qoyulub, 2-ci klik (və ya drag-release) gözlənilir */
  const placingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const brushingRef = useRef(false);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const magnetRef = useRef(magnet);
  magnetRef.current = magnet;
  const visibleRef = useRef(drawingsVisible);
  visibleRef.current = drawingsVisible;
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const patternsRef = useRef(patterns);
  patternsRef.current = patterns;
  const onToolFinishedRef = useRef(onToolFinished);
  onToolFinishedRef.current = onToolFinished;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const setSelected = useCallback((id: string | null) => {
    selectedIdRef.current = id;
    onSelectionChangeRef.current(id !== null);
  }, []);

  // ── Koordinat çevrilmələri ──────────────────────────────────────────────

  /** Uniform bar grid: time (sec) → logical index (fraksiyalı ola bilər) */
  const timeToLogical = useCallback((timeSec: number): number | null => {
    const klines = klinesRef.current;
    if (!klines || klines.length < 2) return null;
    const t0 = klines[0].openTime / 1000;
    const dt = (klines[1].openTime - klines[0].openTime) / 1000;
    if (dt <= 0) return null;
    return (timeSec - t0) / dt;
  }, [klinesRef]);

  const xForTime = useCallback((timeSec: number): number | null => {
    const chart = chartRef.current;
    const logical = timeToLogical(timeSec);
    if (!chart || logical === null) return null;
    const coord = chart.timeScale().logicalToCoordinate(logical as Logical);
    return coord === null ? null : (coord as number);
  }, [chartRef, timeToLogical]);

  const yForPrice = useCallback((price: number): number | null => {
    const series = seriesRef.current;
    if (!series) return null;
    const coord = series.priceToCoordinate(price);
    return coord === null ? null : (coord as number);
  }, [seriesRef]);

  /** Ekran x → bar index + bar time (həmişə şama snap olunur) */
  const barAtX = useCallback((x: number): { index: number; time: number } | null => {
    const chart = chartRef.current;
    const klines = klinesRef.current;
    if (!chart || !klines || klines.length === 0) return null;
    const logical = chart.timeScale().coordinateToLogical(x as never);
    if (logical === null) return null;
    const index = Math.max(0, Math.min(klines.length - 1, Math.round(logical as number)));
    return { index, time: klines[index].openTime / 1000 };
  }, [chartRef, klinesRef]);

  const priceAtY = useCallback((y: number): number | null => {
    const series = seriesRef.current;
    if (!series) return null;
    const price = series.coordinateToPrice(y);
    return price === null ? null : (price as number);
  }, [seriesRef]);

  /** Magnet: bar OHLC dəyərlərindən ən yaxınına snap (piksel həddi ilə) */
  const snapPrice = useCallback((index: number, rawPrice: number, y: number): number => {
    if (!magnetRef.current) return rawPrice;
    const klines = klinesRef.current;
    const k = klines?.[index];
    if (!k) return rawPrice;
    let best = rawPrice;
    let bestDist = MAGNET_TOLERANCE_PX + 1;
    for (const candidate of [k.open, k.high, k.low, k.close]) {
      const cy = yForPrice(candidate);
      if (cy === null) continue;
      const d = Math.abs(cy - y);
      if (d < bestDist) { bestDist = d; best = candidate; }
    }
    return bestDist <= MAGNET_TOLERANCE_PX ? best : rawPrice;
  }, [klinesRef, yForPrice]);

  /** Mouse hadisəsindən drawing point (snap + magnet ilə) */
  const pointFromEvent = useCallback((e: { offsetX: number; offsetY: number }, snapX: boolean): DrawingPoint | null => {
    const bar = barAtX(e.offsetX);
    const rawPrice = priceAtY(e.offsetY);
    if (!bar || rawPrice === null) return null;
    if (snapX) {
      return { time: bar.time, price: snapPrice(bar.index, rawPrice, e.offsetY) };
    }
    // Brush: fraksiyalı x — hamar cizgi
    const chart = chartRef.current;
    const klines = klinesRef.current;
    if (!chart || !klines || klines.length < 2) return null;
    const logical = chart.timeScale().coordinateToLogical(e.offsetX as never);
    if (logical === null) return null;
    const t0 = klines[0].openTime / 1000;
    const dt = (klines[1].openTime - klines[0].openTime) / 1000;
    return { time: t0 + (logical as number) * dt, price: rawPrice };
  }, [barAtX, priceAtY, snapPrice, chartRef, klinesRef]);

  // ── Render ──────────────────────────────────────────────────────────────

  const drawZones = useCallback((ctx: CanvasRenderingContext2D, width: number) => {
    for (const zone of zonesRef.current) {
      const yTop = yForPrice(zone.top);
      const yBottom = yForPrice(zone.bottom);
      if (yTop === null || yBottom === null) continue;
      const h = yBottom - yTop;
      if (h <= 0) continue;

      const rawStart = xForTime(zone.startTime);
      if (rawStart === null) continue;
      // Aktiv zone sağ kənara qədər uzanır; qırılmış zone öz bitmə barında dayanır
      const rawEnd = zone.endTime === null ? width : xForTime(zone.endTime);
      if (rawEnd === null) continue;

      // Görünən sahədən kənardakı zonaları at
      if (rawEnd < 0 || rawStart > width) continue;
      const xStart = Math.max(0, rawStart);
      const xEnd = Math.min(width, rawEnd);
      const w = xEnd - xStart;
      if (w <= 0) continue;

      const isSupply = zone.type === 'supply';
      ctx.fillStyle = isSupply ? SUPPLY_FILL : DEMAND_FILL;
      ctx.fillRect(xStart, yTop, w, h);
      ctx.strokeStyle = isSupply ? SUPPLY_BORDER : DEMAND_BORDER;
      ctx.lineWidth = 1;
      ctx.strokeRect(xStart + 0.5, yTop + 0.5, w - 1, h - 1);

      // Etiket yalnız yer varsa
      if (w >= 46) {
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = isSupply ? 'rgba(239,83,80,0.9)' : 'rgba(38,166,154,0.9)';
        ctx.textBaseline = 'top';
        ctx.fillText(isSupply ? 'Supply' : 'Demand', xStart + 6, yTop + 4);
      }
    }
  }, [yForPrice, xForTime]);

  /**
   * Təsdiqlənmiş formasiyalar: kontur (pivotlar arası qırıq xətt), neckline,
   * ad etiketi və breakout barında istiqamət oxu.
   */
  const drawPatterns = useCallback((ctx: CanvasRenderingContext2D, width: number) => {
    for (const pat of patternsRef.current) {
      const bullish = pat.direction === 'bullish';
      const color = bullish ? '#26a69a' : '#ef5350';

      const pts = pat.outline.map(p => {
        const x = xForTime(p.time);
        const y = yForPrice(p.price);
        return x === null || y === null ? null : { x, y };
      }).filter((p): p is { x: number; y: number } => p !== null);
      if (pts.length < 2) continue;

      // Görünən sahədən tam kənardadırsa çəkmə
      const minX = Math.min(...pts.map(p => p.x));
      const maxX = Math.max(...pts.map(p => p.x));
      const arrowX = xForTime(pat.confirmTime);
      const rightMost = arrowX === null ? maxX : Math.max(maxX, arrowX);
      if (rightMost < 0 || minX > width) continue;

      // Kontur
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();

      // Pivot nöqtələri
      ctx.fillStyle = color;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Neckline / sərhəd
      if (pat.guide && pat.guide.length === 2) {
        const g0x = xForTime(pat.guide[0].time);
        const g0y = yForPrice(pat.guide[0].price);
        const g1x = xForTime(pat.guide[1].time);
        const g1y = yForPrice(pat.guide[1].price);
        if (g0x !== null && g0y !== null && g1x !== null && g1y !== null) {
          ctx.save();
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(g0x, g0y);
          ctx.lineTo(g1x, g1y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Ad etiketi — konturun yuxarısında
      const labelX = Math.max(2, Math.min(pts[0].x, width - 120));
      const topY = Math.min(...pts.map(p => p.y));
      ctx.font = '600 10px Inter, sans-serif';
      const tw = ctx.measureText(pat.label).width;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(labelX, topY - 17, tw + 10, 15);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(pat.label, labelX + 5, topY - 9);

      // İstiqamət oxu — breakout barında
      const ay = yForPrice(pat.arrowPrice);
      if (arrowX === null || ay === null || arrowX < -20 || arrowX > width + 20) continue;
      const dir = bullish ? -1 : 1;      // bullish → yuxarı, bearish → aşağı
      const tipY = ay + dir * 14;        // ucu bardan kənarda
      const tailY = tipY + dir * 26;

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(arrowX, tailY);
      ctx.lineTo(arrowX, tipY + dir * 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arrowX, tipY);
      ctx.lineTo(arrowX - 6, tipY + dir * 10);
      ctx.lineTo(arrowX + 6, tipY + dir * 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [xForTime, yForPrice]);

  /**
   * TradingView-style Supertrend highlighter: qiymət (close) ilə ST xətti
   * arasındakı sahə bullish seqmentdə yaşıl, bearish seqmentdə qırmızı boyanır.
   */
  const drawStFill = useCallback((ctx: CanvasRenderingContext2D) => {
    const stData = stDataRef.current;
    const klines = klinesRef.current;
    const chart = chartRef.current;
    if (!stData || stData.length < 2 || !klines || klines.length < 2 || !chart) return;

    const offset = klines.length - stData.length;

    // Yalnız görünən diapazonu çək — 3000 barlıq tam polygon lazım deyil
    let i0 = 0;
    let i1 = stData.length - 1;
    const vr = chart.timeScale().getVisibleLogicalRange();
    if (vr) {
      i0 = Math.max(0, Math.floor(vr.from) - offset - 1);
      i1 = Math.min(stData.length - 1, Math.ceil(vr.to) - offset + 1);
    }

    let seg: { x: number; yLine: number; yClose: number }[] = [];
    let segTrend: 1 | -1 | 0 = 0;

    const flush = () => {
      if (seg.length >= 2 && segTrend !== 0) {
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].yLine);
        for (let j = 1; j < seg.length; j++) ctx.lineTo(seg[j].x, seg[j].yLine);
        for (let j = seg.length - 1; j >= 0; j--) ctx.lineTo(seg[j].x, seg[j].yClose);
        ctx.closePath();
        ctx.fillStyle = segTrend === 1 ? 'rgba(38,166,154,0.13)' : 'rgba(239,83,80,0.13)';
        ctx.fill();
      }
      seg = [];
    };

    for (let i = i0; i <= i1; i++) {
      const p = stData[i];
      const k = klines[offset + i];
      if (!k) continue;
      const x = xForTime(p.time);
      const yLine = yForPrice(p.value);
      const yClose = yForPrice(k.close);
      if (x === null || yLine === null || yClose === null) {
        flush();
        segTrend = 0;
        continue;
      }
      if (p.trend !== segTrend) {
        flush();
        segTrend = p.trend;
      }
      seg.push({ x, yLine, yClose });
    }
    flush();
  }, [stDataRef, klinesRef, chartRef, xForTime, yForPrice]);

  const drawOne = useCallback((
    ctx: CanvasRenderingContext2D,
    d: Drawing,
    width: number,
    height: number,
    isSelected: boolean,
  ) => {
    const color = isSelected ? DRAWING_SELECTED_COLOR : DRAWING_COLOR;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = isSelected ? 2 : 1.5;

    const pts = d.points.map(p => {
      const x = xForTime(p.time);
      const y = yForPrice(p.price);
      return x === null || y === null ? null : { x, y };
    });

    const p0 = pts[0];
    const p1 = pts[1] ?? p0;
    if (!p0) return;

    switch (d.tool) {
      case 'trend': {
        if (!p1) return;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        break;
      }
      case 'hline': {
        ctx.beginPath();
        ctx.moveTo(0, p0.y);
        ctx.lineTo(width, p0.y);
        ctx.stroke();
        break;
      }
      case 'hray': {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(width, p0.y);
        ctx.stroke();
        break;
      }
      case 'vline': {
        ctx.beginPath();
        ctx.moveTo(p0.x, 0);
        ctx.lineTo(p0.x, height);
        ctx.stroke();
        break;
      }
      case 'rect': {
        if (!p1) return;
        const x = Math.min(p0.x, p1.x);
        const y = Math.min(p0.y, p1.y);
        const w = Math.abs(p1.x - p0.x);
        const h = Math.abs(p1.y - p0.y);
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        break;
      }
      case 'brush': {
        ctx.beginPath();
        let started = false;
        for (const pt of pts) {
          if (!pt) continue;
          if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = '500 12px Inter, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(d.text ?? '', p0.x, p0.y);
        if (isSelected && d.text) {
          const m = ctx.measureText(d.text);
          ctx.strokeStyle = DRAWING_SELECTED_COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(p0.x - 3, p0.y - 16, m.width + 6, 19);
        }
        break;
      }
      case 'ruler': {
        if (!p1) return;
        const x = Math.min(p0.x, p1.x);
        const y = Math.min(p0.y, p1.y);
        const w = Math.abs(p1.x - p0.x);
        const h = Math.abs(p1.y - p0.y);
        ctx.fillStyle = RULER_FILL;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = RULER_BG;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        // Ölçmə etiketi
        const pr0 = d.points[0].price;
        const pr1 = d.points[1]?.price ?? pr0;
        const diff = pr1 - pr0;
        const pct = pr0 !== 0 ? (diff / pr0) * 100 : 0;
        const klines = klinesRef.current;
        let bars = 0;
        if (klines && klines.length >= 2) {
          const dt = (klines[1].openTime - klines[0].openTime) / 1000;
          bars = Math.round(Math.abs((d.points[1]?.time ?? d.points[0].time) - d.points[0].time) / dt);
        }
        const sign = diff >= 0 ? '+' : '';
        const label = `${sign}${diff.toFixed(Math.abs(pr0) < 1 ? 6 : 2)}  (${sign}${pct.toFixed(2)}%)  ${bars} bar`;
        ctx.font = '600 11px Inter, sans-serif';
        const tw = ctx.measureText(label).width;
        const lx = x + w / 2 - tw / 2 - 6;
        const ly = diff >= 0 ? y - 22 : y + h + 4;
        ctx.fillStyle = RULER_BG;
        ctx.fillRect(lx, ly, tw + 12, 18);
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + 6, ly + 9);
        break;
      }
    }

    // Seçilmiş drawing üçün endpoint handle-ları
    if (isSelected && d.tool !== 'brush' && d.tool !== 'text') {
      for (const pt of pts) {
        if (!pt) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = DRAWING_SELECTED_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [xForTime, yForPrice, klinesRef]);

  /** Sil düyməsinin bağlanacağı ekran nöqtəsi */
  const anchorFor = useCallback((d: Drawing, width: number): { x: number; y: number } | null => {
    const screen = d.points.map(p => {
      const x = xForTime(p.time);
      const y = yForPrice(p.price);
      return x === null || y === null ? null : { x, y };
    }).filter((p): p is { x: number; y: number } => p !== null);
    if (screen.length === 0) return null;

    if (d.tool === 'hline') return { x: width / 2, y: screen[0].y };
    if (d.tool === 'vline') return { x: screen[0].x, y: 24 };
    if (screen.length === 1) return screen[0];

    // Çox nöqtəli fiqurlar üçün ən sağdakı nöqtə
    return screen.reduce((a, b) => (b.x > a.x ? b : a));
  }, [xForTime, yForPrice]);

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = parent.clientWidth;
    const cssH = parent.clientHeight;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!chart || !seriesRef.current) return;

    // Pane 0 sahəsi ilə məhdudlaş — sağ price scale & aşağı pane-lərə çəkmə
    let paneWidth = cssW;
    let paneHeight = cssH;
    try {
      paneWidth = chart.timeScale().width();
      paneHeight = chart.panes()[0]?.getHeight() ?? cssH;
    } catch { /* fallback: tam sahə */ }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, paneWidth, paneHeight);
    ctx.clip();

    drawStFill(ctx);
    drawZones(ctx, paneWidth);
    drawPatterns(ctx, paneWidth);

    if (visibleRef.current) {
      for (const d of drawingsRef.current) {
        drawOne(ctx, d, paneWidth, paneHeight, d.id === selectedIdRef.current);
      }
      if (draftRef.current) {
        drawOne(ctx, draftRef.current, paneWidth, paneHeight, false);
      }
    }

    ctx.restore();

    // Seçilmiş drawing üçün üzən sil düyməsini yerləşdir (React re-render olmadan)
    const btn = deleteBtnRef.current;
    if (btn) {
      const sel = visibleRef.current
        ? drawingsRef.current.find(d => d.id === selectedIdRef.current)
        : undefined;
      const anchor = sel ? anchorFor(sel, paneWidth) : null;
      if (anchor && anchor.x >= 0 && anchor.x <= paneWidth && anchor.y >= 0 && anchor.y <= paneHeight) {
        btn.style.display = 'flex';
        btn.style.left = `${anchor.x + 10}px`;
        btn.style.top = `${anchor.y - 26}px`;
      } else {
        btn.style.display = 'none';
      }
    }
  }, [chartRef, seriesRef, drawStFill, drawZones, drawPatterns, drawOne, anchorFor]);

  // rAF render loop — az sayda shape üçün ucuzdur, zoom/pan/resize-ı avtomatik izləyir
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      renderAll();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [renderAll]);

  // ── Hit-test (seçim üçün) ───────────────────────────────────────────────

  const hitTest = useCallback((x: number, y: number): Drawing | null => {
    const canvas = canvasRef.current;
    const width = canvas?.clientWidth ?? 0;
    const height = canvas?.clientHeight ?? 0;

    // Ən son çəkilən üstdədir — tərsinə yoxla
    for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
      const d = drawingsRef.current[i];
      const pts = d.points.map(p => {
        const px = xForTime(p.time);
        const py = yForPrice(p.price);
        return px === null || py === null ? null : { x: px, y: py };
      });
      const p0 = pts[0];
      const p1 = pts[1] ?? p0;
      if (!p0) continue;

      let hit = false;
      switch (d.tool) {
        case 'trend':
          hit = !!p1 && distToSegment(x, y, p0.x, p0.y, p1.x, p1.y) <= HIT_TOLERANCE;
          break;
        case 'hline':
          hit = Math.abs(y - p0.y) <= HIT_TOLERANCE;
          break;
        case 'hray':
          hit = x >= p0.x - HIT_TOLERANCE && Math.abs(y - p0.y) <= HIT_TOLERANCE;
          break;
        case 'vline':
          hit = Math.abs(x - p0.x) <= HIT_TOLERANCE && y >= 0 && y <= height;
          break;
        case 'rect':
        case 'ruler': {
          if (!p1) break;
          const rx = Math.min(p0.x, p1.x) - HIT_TOLERANCE;
          const ry = Math.min(p0.y, p1.y) - HIT_TOLERANCE;
          const rw = Math.abs(p1.x - p0.x) + HIT_TOLERANCE * 2;
          const rh = Math.abs(p1.y - p0.y) + HIT_TOLERANCE * 2;
          hit = x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
          break;
        }
        case 'brush': {
          for (let j = 1; j < pts.length; j++) {
            const a = pts[j - 1];
            const b = pts[j];
            if (a && b && distToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_TOLERANCE) { hit = true; break; }
          }
          break;
        }
        case 'text':
          hit = x >= p0.x - 4 && x <= p0.x + 90 && y >= p0.y - 18 && y <= p0.y + 4;
          break;
      }
      if (hit) return d;
    }
    void width;
    return null;
  }, [xForTime, yForPrice]);

  // Tool aktiv olmayanda seçim chart click-i ilə işləyir (canvas pointer-events: none)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onClick = (param: MouseEventParams<Time>) => {
      if (toolRef.current !== 'none' || !param.point) return;
      const found = hitTest(param.point.x, param.point.y);
      setSelected(found?.id ?? null);
    };
    chart.subscribeClick(onClick);
    return () => { try { chart.unsubscribeClick(onClick); } catch { /* chart disposed */ } };
  }, [chartRef, hitTest, setSelected]);

  // ── Mouse ilə çəkmə ─────────────────────────────────────────────────────

  /** Draft-ı yekunlaşdır: siyahıya əlavə et, aləti sıfırla */
  const commitDraft = useCallback(() => {
    const d = draftRef.current;
    draftRef.current = null;
    placingRef.current = false;
    dragStartRef.current = null;
    brushingRef.current = false;
    if (d) {
      const degenerate = d.tool !== 'brush'
        ? d.points.length >= 2 && d.points[0].time === d.points[1].time && d.points[0].price === d.points[1].price
        : d.points.length < 2;
      if (!degenerate) drawingsRef.current.push(d);
    }
    onToolFinishedRef.current();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const t = toolRef.current;
    if (t === 'none') return;
    const { offsetX, offsetY } = e.nativeEvent;

    if (t === 'text') {
      const p = pointFromEvent({ offsetX, offsetY }, true);
      if (p) setTextDraft({ x: offsetX, y: offsetY, point: p });
      return;
    }

    const p = pointFromEvent({ offsetX, offsetY }, t !== 'brush');
    if (!p) return;

    if (t === 'hline' || t === 'hray' || t === 'vline') {
      drawingsRef.current.push({ id: nextId(), tool: t, points: [p] });
      onToolFinishedRef.current();
      return;
    }

    if (t === 'brush') {
      brushingRef.current = true;
      draftRef.current = { id: nextId(), tool: t, points: [p] };
      return;
    }

    // trend / rect / ruler — TradingView-style: 1-ci klik → 2-ci klik,
    // yaxud klassik press-drag-release. İkisi də dəstəklənir.
    if (placingRef.current && draftRef.current) {
      draftRef.current.points[1] = p;
      commitDraft();
      return;
    }
    draftRef.current = { id: nextId(), tool: t, points: [p, p] };
    placingRef.current = true;
    dragStartRef.current = { x: offsetX, y: offsetY };
  }, [pointFromEvent, commitDraft]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const d = draftRef.current;
    if (!d) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const p = pointFromEvent({ offsetX, offsetY }, d.tool !== 'brush');
    if (!p) return;
    if (d.tool === 'brush') {
      if (brushingRef.current) d.points.push(p);
    } else {
      // Placing rejimində düymə basılı olmasa da preview izləyir
      d.points[1] = p;
    }
  }, [pointFromEvent]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushingRef.current) {
      commitDraft();
      return;
    }
    // İki-nöqtəli alət: kifayət qədər drag olubsa release commit edir;
    // yox əs (sadə klik idisə) placing davam edir — 2-ci klik gözlənilir.
    if (placingRef.current && dragStartRef.current && draftRef.current) {
      const { offsetX, offsetY } = e.nativeEvent;
      const moved = Math.hypot(offsetX - dragStartRef.current.x, offsetY - dragStartRef.current.y);
      if (moved > 5) commitDraft();
    }
  }, [commitDraft]);

  /** Brush zamanı canvasdan çıxanda cizgini yekunlaşdır; placing isə davam edir */
  const handleMouseLeave = useCallback(() => {
    if (brushingRef.current) commitDraft();
  }, [commitDraft]);

  // Alət dəyişəndə yarımçıq draft-ı at
  useEffect(() => {
    draftRef.current = null;
    placingRef.current = false;
    dragStartRef.current = null;
    brushingRef.current = false;
  }, [tool]);

  // Text draft commit
  const commitText = useCallback((value: string) => {
    if (textDraft && value.trim()) {
      drawingsRef.current.push({
        id: nextId(),
        tool: 'text',
        points: [textDraft.point],
        text: value.trim(),
      });
    }
    setTextDraft(null);
    onToolFinishedRef.current();
  }, [textDraft]);

  useEffect(() => {
    if (textDraft) textInputRef.current?.focus();
  }, [textDraft]);

  // Klaviatura: Delete → seçilmişi sil, Escape → ləğv et
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIdRef.current) {
          drawingsRef.current = drawingsRef.current.filter(d => d.id !== selectedIdRef.current);
          setSelected(null);
        }
      } else if (e.key === 'Escape') {
        draftRef.current = null;
        placingRef.current = false;
        dragStartRef.current = null;
        brushingRef.current = false;
        setTextDraft(null);
        setSelected(null);
        onToolFinishedRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelected]);

  /** Yalnız seçilmiş fiquru silir — qalanlarına toxunmur */
  const removeSelected = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    drawingsRef.current = drawingsRef.current.filter(d => d.id !== id);
    setSelected(null);
  }, [setSelected]);

  useImperativeHandle(ref, () => ({
    deleteSelected: removeSelected,
    clearAll() {
      drawingsRef.current = [];
      draftRef.current = null;
      setSelected(null);
    },
  }), [setSelected]);

  const interactive = tool !== 'none';

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10"
        style={{
          pointerEvents: interactive ? 'auto' : 'none',
          cursor: interactive ? 'crosshair' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Seçilmiş fiqurun üzərindəki sil düyməsi — yalnız onu silir */}
      <button
        ref={deleteBtnRef}
        type="button"
        title="Delete this drawing"
        className="absolute z-30 w-6 h-6 items-center justify-center rounded-md border text-xs font-bold"
        style={{
          display: 'none',
          background: 'var(--surface)',
          borderColor: DRAWING_SELECTED_COLOR,
          color: DRAWING_SELECTED_COLOR,
          boxShadow: 'var(--card-shadow)',
          lineHeight: 1,
        }}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
        onClick={e => { e.stopPropagation(); removeSelected(); }}
      >
        ✕
      </button>
      {textDraft && (
        <input
          ref={textInputRef}
          type="text"
          className="absolute z-20 px-1.5 py-0.5 text-xs rounded border outline-none"
          style={{
            left: textDraft.x,
            top: textDraft.y - 12,
            width: 160,
            background: 'var(--surface)',
            borderColor: 'var(--accent)',
            color: 'var(--chart-text-bright)',
          }}
          placeholder="Text..."
          onKeyDown={e => {
            if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value);
            else if (e.key === 'Escape') { setTextDraft(null); onToolFinishedRef.current(); }
          }}
          onBlur={e => commitText(e.target.value)}
        />
      )}
    </>
  );
});
