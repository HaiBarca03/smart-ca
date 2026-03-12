import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmartCATHController } from './smart-ca-th.controller';
import { SmartCATHService } from './smartca-th.service';

@Module({
  imports: [HttpModule],
  controllers: [SmartCATHController],
  providers: [SmartCATHService],
})
export class SmartCaTHModule {}
