import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Transaction } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import {
  PaginatedTransactions,
  TransactionsService,
} from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { ExportTransactionsQueryDto } from './dto/export-transactions-query.dto';

@ApiTags('transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an income or expense transaction' })
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List the current user's transactions (date desc, paginated)",
  })
  findAll(
    @GetUser('id') userId: string,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactions> {
    return this.transactionsService.findAll(userId, query);
  }

  // Declared BEFORE :id so "export" isn't captured by the :id param route.
  @Get('export')
  @ApiOperation({
    summary: "Export the current user's filtered transactions as CSV",
  })
  @ApiProduces('text/csv')
  async exportCsv(
    @GetUser('id') userId: string,
    @Query() query: ExportTransactionsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.transactionsService.exportCsv(userId, query);
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tally-transactions-${date}.csv"`,
    });
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user’s transactions' })
  @ApiNotFoundResponse({
    description: 'Transaction not found or not owned by user',
  })
  findOne(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Transaction> {
    return this.transactionsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit one of your transactions' })
  @ApiNotFoundResponse({
    description: 'Transaction not found or not owned by user',
  })
  update(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of your transactions' })
  @ApiNotFoundResponse({
    description: 'Transaction not found or not owned by user',
  })
  remove(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Transaction> {
    return this.transactionsService.remove(userId, id);
  }
}
