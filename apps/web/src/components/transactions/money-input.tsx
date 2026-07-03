'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Masked decimal input. The value is a STRING and stays a string — it is never
 * parsed to a number. Keystrokes are sanitised to digits + a single dot with at
 * most two decimals, which is exactly the API's amount shape (^\d+(\.\d{1,2})?$).
 */
export function sanitizeMoney(raw: string): string {
  let v = raw.replace(/[^\d.]/g, '');
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    const intPart = v.slice(0, firstDot);
    const decPart = v.slice(firstDot + 1).replace(/\./g, '');
    v = `${intPart}.${decPart.slice(0, 2)}`;
  }
  return v;
}

export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-faint">
        $
      </span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeMoney(e.target.value))}
        placeholder="0.00"
        className="num pl-7"
        {...props}
      />
    </div>
  );
}
