/**
 * Latch (vəziyyət saxlayan) siqnal primitivi — bütün indikatorlar üçün ortaq.
 *
 * Bir indikator BUY (və ya SELL) trigger-i verdikdən sonra əks trigger gələnə
 * qədər həmin vəziyyətdə qalır. MACD histoqramı bunu təbii şəkildə edir
 * (işarə dəyişənə qədər eyni qalır); RSI kimi səviyyə-əsaslı indikatorlar isə
 * xəttdən geri qayıdanda "siqnal itdi" kimi görünürdü. latchDirs() onları
 * eyni qaydaya salır: siqnal əks trigger gələnə qədər qüvvədədir.
 */

/** Bir şam üçün istiqamət: 1 = BUY, -1 = SELL, 0 = trigger yoxdur / neytral */
export type SignalDir = 1 | 0 | -1;

/**
 * Trigger massivini davamlı vəziyyət massivinə çevirir.
 *
 * İlk trigger-ə qədər (warm-up) 0 = NEUTRAL qalır, yəni siqnal yaranmır.
 * Sonra hər şam son verilən istiqaməti daşıyır.
 */
export function latchDirs(triggers: readonly SignalDir[]): SignalDir[] {
  const out: SignalDir[] = new Array(triggers.length).fill(0);
  let state: SignalDir = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i] !== 0) state = triggers[i];
    out[i] = state;
  }
  return out;
}

/**
 * Latched massivin sonundan geriyə doğru eyni istiqamətdə neçə şam olduğunu
 * sayır — yəni son flip-dən bəri keçən şam sayı (siqnalın "yaşı").
 */
export function latchAge(dirs: readonly SignalDir[], maxLookback = Infinity): number {
  if (dirs.length === 0) return 0;
  const last = dirs[dirs.length - 1];
  if (last === 0) return 0;

  let count = 0;
  for (let i = dirs.length - 1; i >= 0 && count < maxLookback; i--) {
    if (dirs[i] !== last) break;
    count++;
  }
  return count;
}
