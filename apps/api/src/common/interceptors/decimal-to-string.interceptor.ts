import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Money-as-string, applied globally.
 *
 * Every Decimal that leaves the API must serialize as a STRING, never a JS
 * number (governance: money integrity). This interceptor walks each response
 * and converts any Prisma.Decimal to a fixed 2-decimal string (e.g. "1250.00").
 *
 * Reuse: it is registered once as an APP_INTERCEPTOR (see AppModule), so it
 * covers every controller automatically. Future modules just return Prisma
 * rows with Decimal columns — no per-field work needed. All Decimals in this
 * app are money (2dp); if a non-money Decimal is ever introduced, give it its
 * own explicit serialization rather than relying on this default.
 */
export function serializeDecimals(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toFixed(2);
  }
  // Leave Dates (and other non-plain objects) intact for normal JSON handling.
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeDecimals);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeDecimals(val);
    }
    return out;
  }
  return value;
}

@Injectable()
export class DecimalToStringInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeDecimals(data)));
  }
}
