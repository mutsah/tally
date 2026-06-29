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
import { Account } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('accounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an account for the current user' })
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<Account> {
    return this.accountsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's accounts" })
  findAll(@GetUser('id') userId: string): Promise<Account[]> {
    return this.accountsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user’s accounts' })
  @ApiNotFoundResponse({
    description: 'Account not found or not owned by user',
  })
  findOne(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Account> {
    return this.accountsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or archive one of your accounts' })
  @ApiNotFoundResponse({
    description: 'Account not found or not owned by user',
  })
  update(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<Account> {
    return this.accountsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of your accounts' })
  @ApiNotFoundResponse({
    description: 'Account not found or not owned by user',
  })
  remove(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Account> {
    return this.accountsService.remove(userId, id);
  }
}
