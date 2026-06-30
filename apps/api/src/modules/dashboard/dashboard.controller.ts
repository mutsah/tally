import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import {
  DashboardService,
  IncomeVsExpense,
  NetWorth,
  SpendingByCategory,
} from './dashboard.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('net-worth')
  @ApiOperation({
    summary: 'Total net worth + per-account breakdown (non-archived)',
  })
  netWorth(@GetUser('id') userId: string): Promise<NetWorth> {
    return this.dashboardService.netWorth(userId);
  }

  @Get('spending-by-category')
  @ApiOperation({
    summary: 'Expense totals by category (parent rollups, transfers excluded)',
  })
  spendingByCategory(
    @GetUser('id') userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<SpendingByCategory> {
    return this.dashboardService.spendingByCategory(
      userId,
      query.from,
      query.to,
    );
  }

  @Get('income-vs-expense')
  @ApiOperation({
    summary: 'Total income vs expense + net (transfers excluded)',
  })
  incomeVsExpense(
    @GetUser('id') userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<IncomeVsExpense> {
    return this.dashboardService.incomeVsExpense(userId, query.from, query.to);
  }

  @Get('recent-activity')
  @ApiOperation({
    summary: 'Most recent transactions (includes transfers), date desc',
  })
  recentActivity(
    @GetUser('id') userId: string,
    @Query() query: RecentActivityQueryDto,
  ) {
    return this.dashboardService.recentActivity(userId, query.limit);
  }
}
