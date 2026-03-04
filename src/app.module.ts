import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SmartCaModule } from './smart-ca/smart-ca.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SmartCaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
