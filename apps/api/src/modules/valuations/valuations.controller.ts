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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountValuation } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { ValuationsService } from './valuations.service';
import { CreateValuationDto } from './dto/create-valuation.dto';
import { UpdateValuationDto } from './dto/update-valuation.dto';
import { ListValuationsQueryDto } from './dto/list-valuations-query.dto';

@ApiTags('valuations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('valuations')
export class ValuationsController {
  constructor(private readonly valuationsService: ValuationsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Record a value snapshot for a valued (investment/microloan) account',
  })
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateValuationDto,
  ): Promise<AccountValuation> {
    return this.valuationsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      "List the current user's valuations (asOf desc, optional account filter)",
  })
  findAll(
    @GetUser('id') userId: string,
    @Query() query: ListValuationsQueryDto,
  ): Promise<AccountValuation[]> {
    return this.valuationsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user’s valuations' })
  @ApiNotFoundResponse({
    description: 'Valuation not found or not owned by user',
  })
  findOne(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountValuation> {
    return this.valuationsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit one of your valuations (value/asOf/note)' })
  @ApiNotFoundResponse({
    description: 'Valuation not found or not owned by user',
  })
  update(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateValuationDto,
  ): Promise<AccountValuation> {
    return this.valuationsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of your valuations' })
  @ApiNotFoundResponse({
    description: 'Valuation not found or not owned by user',
  })
  remove(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountValuation> {
    return this.valuationsService.remove(userId, id);
  }
}
