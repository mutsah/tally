import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  // AccountsModule exports AccountsService — the runway buffer reuses its grouped
  // balance computation, exactly as the dashboard's net worth does.
  imports: [PrismaModule, AccountsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
