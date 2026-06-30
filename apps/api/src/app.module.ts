import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ValuationsModule } from './modules/valuations/valuations.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from './modules/mail/mail.module';
import { DecimalToStringInterceptor } from './common/interceptors/decimal-to-string.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10,
      },
    ]),
    PrismaModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    ValuationsModule,
    DashboardModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Money-as-string: serialize every Prisma Decimal in responses as a string.
    { provide: APP_INTERCEPTOR, useClass: DecimalToStringInterceptor },
  ],
})
export class AppModule {}
