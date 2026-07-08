import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [PrismaModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
