import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import {
  MonthlyAdherence,
  MonthlyCategorySpending,
  MonthlyTotals,
  ReportsService,
  Runway,
  SpendingLeak,
} from './reports.service';
import { ReportsRangeQueryDto } from './dto/reports-range-query.dto';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly-income-expense')
  @ApiOperation({
    summary:
      'Monthly income / expense / net over a trailing range (dense, transfers + opening excluded)',
  })
  monthlyIncomeExpense(
    @GetUser('id') userId: string,
    @Query() query: ReportsRangeQueryDto,
  ): Promise<MonthlyTotals[]> {
    return this.reportsService.monthlyIncomeExpense(userId, query.months);
  }

  @Get('monthly-expense-by-category')
  @ApiOperation({
    summary:
      'Monthly expense by category over a trailing range (parent rollups, dense)',
  })
  monthlyExpenseByCategory(
    @GetUser('id') userId: string,
    @Query() query: ReportsRangeQueryDto,
  ): Promise<MonthlyCategorySpending[]> {
    return this.reportsService.monthlyExpenseByCategory(userId, query.months);
  }

  @Get('monthly-budget-adherence')
  @ApiOperation({
    summary:
      'Monthly budgeted-vs-spent over a trailing range (dense; budgeted is the current limits, flat across months)',
  })
  monthlyBudgetAdherence(
    @GetUser('id') userId: string,
    @Query() query: ReportsRangeQueryDto,
  ): Promise<MonthlyAdherence[]> {
    return this.reportsService.monthlyBudgetAdherence(userId, query.months);
  }

  // Point-in-time snapshots — no range query, unlike the monthly series above.

  @Get('runway')
  @ApiOperation({
    summary:
      'Cash runway: liquid buffer, average monthly burn over the last 3 complete months, and months of runway (null when not burning)',
  })
  runway(@GetUser('id') userId: string): Promise<Runway> {
    return this.reportsService.runway(userId);
  }

  @Get('spending-leaks')
  @ApiOperation({
    summary:
      'Categories whose latest complete month exceeds their 3-month trailing average by >25% (heuristic; biggest first)',
  })
  spendingLeaks(@GetUser('id') userId: string): Promise<SpendingLeak[]> {
    return this.reportsService.spendingLeaks(userId);
  }
}
