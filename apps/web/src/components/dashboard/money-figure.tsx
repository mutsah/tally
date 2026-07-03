import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

// Renders a money STRING as a JetBrains Mono figure with the cents de-emphasised
// (matching the dashboard mock). Purely string-based — never parsed to a float.
export function MoneyFigure({
  value,
  className,
  centsClassName,
}: {
  value: string;
  className?: string;
  centsClassName?: string;
}) {
  const formatted = formatMoney(value); // e.g. "$1,250.00"
  const dot = formatted.lastIndexOf('.');
  const whole = dot === -1 ? formatted : formatted.slice(0, dot);
  const cents = dot === -1 ? '' : formatted.slice(dot);
  return (
    <span className={cn('num tabular-nums', className)}>
      {whole}
      {cents ? (
        <span className={cn('opacity-60', centsClassName)}>{cents}</span>
      ) : null}
    </span>
  );
}
