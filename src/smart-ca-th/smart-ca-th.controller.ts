import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SmartCATHDetailDto } from './dto/smart-ca-th.dto';
import { SmartCATHService } from './smartca-th.service';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InitSignRequestDto } from 'src/smart-ca/dto/init-sign-request.dto';
import { InitSignResponseDto } from 'src/smart-ca/dto/init-sign-response.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ConfirmSignRequestDto } from './dto/req-confirm-sign.dto';

@Controller('smart-ca-th')
export class SmartCATHController {
  private readonly logger = new Logger(SmartCATHController.name);
  private readonly be_url: string;
  private readonly anycross_webhook_url_ben_a: string;
  private readonly anycross_webhook_url_ben_b: string;

  constructor(
    private readonly smartCATHService: SmartCATHService,
    private readonly configService: ConfigService,
  ) {
    this.be_url = this.configService.get<string>('BE_URL') ?? '';
    this.anycross_webhook_url_ben_a =
      this.configService.get<string>('ANYCROSS_WEB_HOOK_URL_BEN_A') ?? '';
    this.anycross_webhook_url_ben_b =
      this.configService.get<string>('ANYCROSS_WEB_HOOK_URL_BEN_B') ?? '';
  }

  //   @ApiOperation({ summary: 'Initiate signing process (Base64)' })
  //   @ApiConsumes('application/json')
  //   @ApiBody({ type: InitSignRequestDto })
  //   @Post('sign-hash')
  //   async signHash(
  //         @Body('fileBase64') fileBase64: string,
  //         @Body('fileName') fileName: string,
  //         @Body('docType') docType: string,
  //         @Body('role') role: string,
  //         @Body('contractId') contractId: string,
  //         @Body('userId') userId: string,
  //         @Body('signerName') signerName: string,
  //   ) {
  //         this.logger.log('Received init-sign request with Base64');

  //         if (!fileBase64) {
  //           throw new HttpException('Base64 file string is required', HttpStatus.BAD_REQUEST);
  //         }

  //         const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, '');
  //         const originalName = fileName || 'document.pdf';

  //         const certData = await this.smartCATHService.getCertificate(userId);
  //         const userCert = certData.data.user_certificates[0];
  //         const certBase64 = userCert.cert_data;
  //         const serialNumber = userCert.serial_number;

  //         const hashData = await this.smartCATHService.calculateHash(cleanBase64, certBase64, docType, role, signerName);
  //         const hash = hashData.hashResps[0].hash;
  //         const fileID = hashData.hashResps[0].fileID;
  //         const transIdHash = hashData.tranId;
  //         const docIdPayload = `${originalName}|${fileID}|${transIdHash}|${contractId}`;

  //         const signData = await this.smartCATHService.signHash(hash, serialNumber, docIdPayload, userId);
  //         const transactionId = signData.data.transaction_id;
  //         const sad = signData.data.sad;

  //         const confirmSign = await this.smartCATHService.confirmSign(transactionId, sad, userId)
  //         const signature_value = confirmSign.data.signatures.signature_value
  //         const finalData = await this.smartCATHService.signExternal(
  //             transIdHash,
  //             fileID,
  //             signature_value
  //         );

  //         const signedPdfBase64 = finalData.signResps[0].signedData;

  //         // console.log('SIGNED PDF BASE64 LENGTH:', signedPdfBase64.length);

  //         const savedFileName =
  //             await this.smartCATHService.savePdfFile(
  //             signedPdfBase64,
  //             originalName
  //         );

  //         const downloadUrl =
  //             `${this.be_url}/smart-ca/download/${savedFileName}`;

  //         const payload = {
  //             transaction_id: transactionId,
  //             fileName: savedFileName,
  //             fileContent: signedPdfBase64,
  //             originalName,
  //             downloadUrl,
  //             status: 'success',
  //             contractId,
  //             signedAt: new Date().toISOString(),
  //             role,
  //         }

  //         console.log('DOWNLOAD URL:', downloadUrl);
  //         let webhookUrl: string | null = null;
  //           let callbackName = 'Unknown';

  //           const normalizedRole = role?.toUpperCase().trim();

  //           if (normalizedRole === 'BEN_A') {
  //               webhookUrl = this.anycross_webhook_url_ben_a;
  //               callbackName = 'BEN_A';
  //           } else if (normalizedRole === 'BEN_B') {
  //               webhookUrl = this.anycross_webhook_url_ben_b;
  //               callbackName = 'BEN_B';
  //           } else {
  //               this.logger.warn(`Không hỗ trợ callback cho role: ${role || 'undefined'}`);
  //           }

  //           if (webhookUrl) {
  //               try {
  //                   const response = await axios.post(
  //                       webhookUrl,
  //                       payload,
  //                       {
  //                           timeout: 10000,
  //                           headers: { 'Content-Type': 'application/json' },
  //                       }
  //                   );

  //                   this.logger.log(`${callbackName} CALLBACK SUCCESS - Status: ${response.status}`);

  //               } catch (err) {
  //                   const errorMsg = err.response
  //                       ? `${err.response.status} - ${JSON.stringify(err.response.data)}`
  //                       : err.message;

  //                   console.error(`${callbackName} CALLBACK ERROR:`, errorMsg);
  //                   this.logger.error(`${callbackName} CALLBACK ERROR: ${errorMsg}`);
  //               }
  //           } else {
  //               this.logger.log('Bỏ qua callback vì role không khớp hoặc không có URL');
  //           }

  //           console.log('===== SIGN FLOW COMPLETED =====');

  //           return {
  //               message: 'Signing completed',
  //               transactionId,
  //               contractId,
  //               signature_value,
  //               downloadUrl
  //           };
  //   }

  @ApiOperation({ summary: 'Initiate signing process (Base64)' })
  @ApiConsumes('application/json')
  @ApiBody({ type: InitSignRequestDto })
  @Post('init-sign')
  async initSign(
    @Body('fileBase64') fileBase64: string,
    @Body('fileName') fileName: string,
    @Body('docType') docType: string,
    @Body('role') role: string,
    @Body('contractId') contractId: string,
    @Body('userId') userId: string,
    @Body('signerName') signerName: string,
  ) {
    if (!fileBase64) {
      throw new HttpException(
        'Base64 file string is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cleanBase64 = fileBase64.replace(
      /^data:application\/pdf;base64,/,
      '',
    );
    const originalName = fileName || 'document.pdf';

    const certData = await this.smartCATHService.getCertificate(userId);
    const userCert = certData.data.user_certificates[0];

    const certBase64 = userCert.cert_data;
    const serialNumber = userCert.serial_number;

    const hashData = await this.smartCATHService.calculateHash(
      cleanBase64,
      certBase64,
      docType,
      role,
      signerName,
    );

    const hash = hashData.hashResps[0].hash;
    const fileID = hashData.hashResps[0].fileID;
    const transIdHash = hashData.tranId;

    const docIdPayload = `${originalName}|${fileID}|${transIdHash}|${contractId}`;

    const signData = await this.smartCATHService.signHash(
      hash,
      serialNumber,
      docIdPayload,
      userId,
    );

    const transactionId = signData.data.transaction_id;
    const sad = signData.data.sad;

    return {
      message: 'Init sign success',
      transactionId,
      sad,
      transIdHash,
      fileID,
      originalName,
      contractId,
      role,
    };
  }

  @ApiOperation({ summary: 'Confirm signing process' })
  @Post('confirm-sign')
  @ApiBody({ type: ConfirmSignRequestDto })
  async confirmSign(
    @Body('transactionId') transactionId: string,
    @Body('sad') sad: string,
    @Body('userId') userId: string,
    @Body('transIdHash') transIdHash: string,
    @Body('fileID') fileID: string,
    @Body('originalName') originalName: string,
    @Body('contractId') contractId: string,
    @Body('role') role: string,
  ) {
    const confirmSign = await this.smartCATHService.confirmSign(
      transactionId,
      sad,
      userId,
    );

    const signature_value = confirmSign.data.signatures[0].signature_value;

    const finalData = await this.smartCATHService.signExternal(
      transIdHash,
      fileID,
      signature_value,
    );

    const signedPdfBase64 = finalData.signResps[0].signedData;

    const savedFileName = await this.smartCATHService.savePdfFile(
      signedPdfBase64,
      originalName,
    );

    const downloadUrl = `${this.be_url}/smart-ca/download/${savedFileName}`;

    const payload = {
      transaction_id: transactionId,
      fileName: savedFileName,
      fileContent: signedPdfBase64,
      originalName,
      downloadUrl,
      status: 'success',
      contractId,
      signedAt: new Date().toISOString(),
      role,
    };

    console.log('DOWNLOAD URL:', downloadUrl);
    let webhookUrl: string | null = null;
    let callbackName = 'Unknown';

    const normalizedRole = role?.toUpperCase().trim();

    if (normalizedRole === 'BEN_A') {
      webhookUrl = this.anycross_webhook_url_ben_a;
      callbackName = 'BEN_A';
    } else if (normalizedRole === 'BEN_B') {
      webhookUrl = this.anycross_webhook_url_ben_b;
      callbackName = 'BEN_B';
    } else {
      this.logger.warn(
        `Không hỗ trợ callback cho role: ${role || 'undefined'}`,
      );
    }

    if (webhookUrl) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        });

        this.logger.log(
          `${callbackName} CALLBACK SUCCESS - Status: ${response.status}`,
        );
      } catch (err) {
        const errorMsg = err.response
          ? `${err.response.status} - ${JSON.stringify(err.response.data)}`
          : err.message;

        console.error(`${callbackName} CALLBACK ERROR:`, errorMsg);
        this.logger.error(`${callbackName} CALLBACK ERROR: ${errorMsg}`);
      }
    } else {
      this.logger.log('Bỏ qua callback vì role không khớp hoặc không có URL');
    }

    console.log('===== SIGN FLOW COMPLETED =====');

    return {
      message: 'Signing completed',
      transactionId,
      contractId,
      signature_value,
      downloadUrl,
    };
  }
}
