/** TradingView-style drawing alətləri */
export type DrawingTool =
  | 'none'
  | 'trend'
  | 'hline'
  | 'hray'
  | 'vline'
  | 'rect'
  | 'brush'
  | 'text'
  | 'ruler';

/** Chart koordinatlarında saxlanan nöqtə — zoom/pan/resize-a davamlıdır */
export interface DrawingPoint {
  /** Bar vaxtı (saniyə). Brush üçün fraksiyalı ola bilər */
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  tool: Exclude<DrawingTool, 'none'>;
  points: DrawingPoint[];
  text?: string;
}

export const DRAWING_COLOR = '#2962ff';
export const DRAWING_SELECTED_COLOR = '#f7931a';
export const RULER_FILL = 'rgba(41,98,255,0.12)';
export const RULER_BG = 'rgba(41,98,255,0.9)';

export const SUPPLY_FILL = 'rgba(239,83,80,0.10)';
export const SUPPLY_BORDER = 'rgba(239,83,80,0.45)';
export const DEMAND_FILL = 'rgba(38,166,154,0.10)';
export const DEMAND_BORDER = 'rgba(38,166,154,0.45)';
