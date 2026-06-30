import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ValuationsController } from './valuations.controller';
import { ValuationsService } from './valuations.service';

@Module({
  imports: [PrismaModule],
  controllers: [ValuationsController],
  providers: [ValuationsService],
})
export class ValuationsModule {}
