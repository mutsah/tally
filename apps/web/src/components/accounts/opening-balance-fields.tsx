'use client';

import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/transactions/money-input';

// Amount + as-of date for an opening balance. Amount is a masked decimal STRING
// (reuses the F3 money input) and never becomes a float. Used by both the
// account-create form and the "Set starting balance" modal.
export function OpeningBalanceFields({
  amount,
  onAmountChange,
  date,
  onDateChange,
  help,
}: {
  amount: string;
  onAmountChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  help: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-xs text-faint">
            Starting balance
          </label>
          <MoneyInput value={amount} onChange={onAmountChange} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-xs text-faint">As of</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
      </div>
      <p className="font-mono text-xs text-faint">{help}</p>
    </div>
  );
}
