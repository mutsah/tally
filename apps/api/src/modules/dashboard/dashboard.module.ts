import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccountsModule } from '../accounts/accounts.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, AccountsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
