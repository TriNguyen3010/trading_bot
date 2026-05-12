export interface SliderProps {
  value: number;
  onValueChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
}

/**
 * Native HTML range input wrapped in Tailwind styling.
 *
 * Renders the slider on the left flexing to fill, with a fixed-width
 * tabular-nums value chip on the right. `accent-brand` colors the track
 * and thumb to the Coin98 brand on Chrome/Edge/Firefox; Safari falls
 * back to default.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
  ariaLabel,
}: SliderProps) {
  return (
    <div role="group" className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="h-1 flex-1 cursor-pointer accent-brand"
      />
      <span className="min-w-[3rem] text-right text-sm font-medium tabular-nums text-fg">
        {value}
        {suffix}
      </span>
    </div>
  );
}
