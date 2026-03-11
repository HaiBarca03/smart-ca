import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { authenticator } from 'otplib';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { SmartCATHDetailDto } from './dto/smart-ca-th.dto';

@Injectable()
export class SmartCATHService {
  constructor(private readonly httpService: HttpService) {}

  private generateOTP(secret: string): string {
    authenticator.options = {
      digits: 6,
      step: 30,
    };

    return authenticator.generate(secret);
  }

  async getCertificate(detail: SmartCATHDetailDto) {
    const url = `${detail.url}/sca/sp769/v1/credentials/get_certificate`;
    const payload = {
      sp_id: detail.sp_id,
      sp_password: detail.sp_password,
      user_id: detail.user_id,
      serial_number: detail.serial_number || '',
      transaction_id: uuidv4(),
    };

    const res = await firstValueFrom(this.httpService.post(url, payload));
    return res.data;
  }

  async signHash(detail: SmartCATHDetailDto, hashHex: string) {
    const url = `${detail.url}/sca/sp769/v2/signatures/sign`;
    const otp = this.generateOTP(detail.totp_secret);

    const payload = {
      sp_id: detail.sp_id,
      sp_password: detail.sp_password,
      user_id: detail.user_id,
      password: detail.password,
      otp: otp,
      transaction_id: uuidv4(),
      serial_number: detail.serial_number,
      sign_files: [
        {
          data_to_be_signed: hashHex,
          doc_id: uuidv4(),
          file_type: 'pdf',
          sign_type: 'hash',
        },
      ],
    };

    const res = await firstValueFrom(this.httpService.post(url, payload));
    return res.data;
  }

  async confirmSign(detail: SmartCATHDetailDto, transId: string, sad: string) {
    const url = `${detail.url}/sca/sp769/v2/signatures/confirm`;
    const payload = {
      sp_id: detail.sp_id,
      sp_password: detail.sp_password,
      user_id: detail.user_id,
      password: detail.password,
      transaction_id: transId,
      sad: sad,
    };

    const res = await firstValueFrom(this.httpService.post(url, payload));
    return res.data;
  }

  async processSigning(detail: SmartCATHDetailDto, hashHex: string) {
    try {
      const certRes = await this.getCertificate(detail);
      if (certRes.status_code !== 0) throw new Error('Get Certificate Failed');
      
      detail.serial_number = certRes.data.user_certificates[0].serial_number;

      const signRes = await this.signHash(detail, hashHex);
      if (signRes.status_code !== 0) throw new Error('Sign Request Failed');

      const confirmRes = await this.confirmSign(
        detail, 
        signRes.data.transaction_id, 
        signRes.data.sad
      );

      return confirmRes.data.signatures[0].signature_value;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}