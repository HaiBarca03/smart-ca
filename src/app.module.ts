import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SmartCaModule } from './smart-ca/smart-ca.module';
import { SmartCaTHModule } from './smart-ca-th/smart-ca-th.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SmartCaModule, SmartCaTHModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
