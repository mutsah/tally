import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
