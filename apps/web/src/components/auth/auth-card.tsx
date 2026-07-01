import { Sprout } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function AuthCard({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col gap-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-[12px] bg-gold text-pine-deep">
            <Sprout className="size-5" />
          </span>
          <div className="font-display text-xl text-pine-deep">Tally</div>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
