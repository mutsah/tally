import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Budget } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@ApiTags('budgets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiOperation({
    summary: 'Set a monthly limit for one of your categories',
  })
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateBudgetDto,
  ): Promise<Budget> {
    return this.budgetsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's budgets" })
  findAll(@GetUser('id') userId: string): Promise<Budget[]> {
    return this.budgetsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of your budgets' })
  @ApiNotFoundResponse({ description: 'Budget not found or not owned by user' })
  findOne(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Budget> {
    return this.budgetsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a budget’s monthly limit' })
  @ApiNotFoundResponse({ description: 'Budget not found or not owned by user' })
  update(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<Budget> {
    return this.budgetsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of your budgets' })
  @ApiNotFoundResponse({ description: 'Budget not found or not owned by user' })
  remove(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Budget> {
    return this.budgetsService.remove(userId, id);
  }
}
