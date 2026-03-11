import { Controller, Post, Body } from '@nestjs/common';
import { SmartCATHDetailDto } from './dto/smart-ca-th.dto';
import { SmartCATHService } from './smartca-th.service';

@Controller('smart-ca-th')
export class SmartCATHController {
  constructor(private readonly smartCATHService: SmartCATHService) {}

  @Post('sign-hash')
  async signHash(@Body() body: { detail: SmartCATHDetailDto, hashHex: string }) {
    const signatureValue = await this.smartCATHService.processSigning(
      body.detail, 
      body.hashHex
    );
    return {
      success: true,
      signature_value: signatureValue
    };
  }
}