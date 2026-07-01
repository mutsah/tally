import Link from 'next/link';
import { ArrowRight, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// F0 theme proof: shadcn button/card/input consuming Tally tokens (pine + gold),
// never the shadcn zinc/Inter default. Replaced by real screens in later phases.
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[12px] bg-gold text-pine-deep">
          <Sprout className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl">Tally</h1>
          <p className="text-muted-foreground text-sm">F0 · theme foundation</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pine &amp; gold, not zinc</CardTitle>
          <CardDescription>
            shadcn/ui components rendering through the Tally design tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-3">
            <Button>Primary · pine</Button>
            <Button variant="accent">Accent · gold</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <Input placeholder="Amount — e.g. 1250.00" />
          <p className="num text-muted-foreground text-sm">
            1,250.00 — money renders in JetBrains Mono with tabular figures
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/login">
            (auth)/login <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            (app)/dashboard <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  );
}
