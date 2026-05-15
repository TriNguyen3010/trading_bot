const CANDLE_REF_LABELS: Record<string, string> = {
  'candle.open': 'Open price',
  'candle.close': 'Close price',
  'candle.high': 'High price',
  'candle.low': 'Low price',
  'candle.volume': 'Volume',
};

function titleCaseWords(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatConditionRefLabel(
  ref: string | null | undefined,
): string {
  if (!ref) return '?';
  if (ref in CANDLE_REF_LABELS) return CANDLE_REF_LABELS[ref];
  if (ref.startsWith('candle.')) {
    return `Candle ${titleCaseWords(ref.slice('candle.'.length))}`;
  }
  return ref;
}
