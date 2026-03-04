import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmartCaService } from './smart-ca.service';
import { SmartCaController } from './smart-ca.controller';
import { LarkDriveService } from './lark-drive.service';

@Module({
  imports: [HttpModule],
  controllers: [SmartCaController],
  providers: [SmartCaService, LarkDriveService],
})
export class SmartCaModule { }
