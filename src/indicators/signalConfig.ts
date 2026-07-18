/**
 * Vahid siqnal siyasəti — bütün modullar eyni RSI/volume hədlərini istifadə edir.
 * TradingView Wilder RSI(14) ilə uyğun hesab; interpretasiya burada mərkəzləşib.
 */

export const RSI_PERIOD = 14;

/** Güclü oversold / overbought */
export const RSI_STRONG_OS = 25;
export const RSI_STRONG_OB = 75;

/** Yumşaq (mild) band — trend-against siqnallar üçün */
export const RSI_MILD_OS = 38;
export const RSI_MILD_OB = 62;

/** Orta zona — neytral / range */
export const RSI_MID = 50;

/** Volume təsdiqi */
export const VOL_BUY_RATIO_CONFIRM = 0.55;
export const VOL_SELL_RATIO_CONFIRM = 0.45;
export const VOL_LOOKBACK = 8;
export const VOL_SMA_PERIOD = 20;
export const VOL_EXPANSION_MULT = 1.25;
export const VOL_DRY_MULT = 0.75;

/** Setup / confidence — keyfiyyətli amma görünən siqnallar */
export const MIN_BUY_VOTES = 2;
export const MIN_SELL_VOTES = 2;
export const BUY_CONVICTION = 3.55;
export const STRONG_BUY_CONVICTION = 4.25;
export const SELL_CONVICTION = 2.45;
export const STRONG_SELL_CONVICTION = 1.75;
export const MIN_CONFIDENCE_SHOW = 40;
export const MIN_RR_ACCEPT = 1.2;

/** Zone breakout */
export const BREAKOUT_MIN_CONFIRMS = 2;
export const BREAKOUT_STRONG_CONFIRMS = 3;

/** Chart TF score (raw closes) */
export const CHART_TF_BUY_SCORE = 2.0;
export const CHART_TF_STRONG_SCORE = 2.8;
