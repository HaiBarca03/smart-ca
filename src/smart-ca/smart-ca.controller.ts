import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Logger,
  Get,
  Param,
  Res,
  StreamableFile,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import * as path from 'path';
import { SmartCaService } from './smart-ca.service';
import { removeVietnameseTones } from 'src/utils/text.util';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LarkDriveService } from './lark-drive.service';
import { VnptWebhookDto } from './dto/vnpt.webhook.dto';
import { CheckStatusResponseDto } from './dto/check-status-response.dto';
import { InitSignResponseDto } from './dto/init-sign-response.dto';
import { InitSignRequestDto } from './dto/init-sign-request.dto';

@ApiTags('smart-ca')
@Controller('smart-ca')
export class SmartCaController {
  private readonly logger = new Logger(SmartCaController.name);
  private readonly be_url: string;
  private readonly anycross_webhook_url_ben_a: string;
  private readonly anycross_webhook_url_ben_b: string;

  constructor(
    private readonly smartCaService: SmartCaService,
    private readonly configService: ConfigService,
    private larkDriveService: LarkDriveService,
  ) {
    this.be_url = this.configService.get<string>('BE_URL') ?? '';
    this.anycross_webhook_url_ben_a =
      this.configService.get<string>('ANYCROSS_WEB_HOOK_URL_BEN_A') ?? '';
    this.anycross_webhook_url_ben_b =
      this.configService.get<string>('ANYCROSS_WEB_HOOK_URL_BEN_B') ?? '';
  }

  @ApiOperation({ summary: 'Initiate signing process (Base64)' })
  @ApiConsumes('application/json')
  @ApiBody({ type: InitSignRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Signing initiated successfully',
    type: InitSignResponseDto,
  })
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
    this.logger.log('Received init-sign request with Base64');

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
    const docId = removeVietnameseTones(originalName);

    // 1. Get Certificate
    // const certData = await this.smartCaService.getCertificate();
    const certData = await this.smartCaService.getCertificate(userId);
    const userCert = certData.data.user_certificates[0];
    const certBase64 = userCert.cert_data;
    const serialNumber = userCert.serial_number;

    // 2. Calculate Hash (Sử dụng cleanBase64 trực tiếp)
    const hashData = await this.smartCaService.calculateHash(
      cleanBase64,
      certBase64,
      docType,
      role,
      // signerName,
    );
    const hash = hashData.hashResps[0].hash;
    const fileID = hashData.hashResps[0].fileID;
    const transIdHash = hashData.tranId;
    const docIdPayload = `${originalName}|${fileID}|${transIdHash}|${contractId}`;

    // 3. Sign Hash
    const signData = await this.smartCaService.signHash(
      hash,
      serialNumber,
      docIdPayload,
      userId,
    );
    const transactionId = signData.data.transaction_id;

    const result = {
      message: 'Signing initiated. Please confirm on mobile app.',
      transactionId,
      transIdHash,
      fileId: fileID,
      originalFileName: originalName,
    };

    console.log('================= INIT SIGN RESULT =================');
    console.log(JSON.stringify(result, null, 2));
    console.log('====================================================');

    // return result;
    return {
      message: 'Signing initiated. Please confirm on mobile app.',
      transactionId,
      transIdHash,
      fileId: fileID,
      originalFileName: originalName,
    };
  }

  @ApiOperation({ summary: 'Webhook nhận thông tin ký số từ CA' })
  @ApiBody({
    type: VnptWebhookDto,
    description:
      'Dữ liệu webhook từ CA sau khi người dùng ký số trên app thành công',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Webhook processed and file saved',
        fileName: 'contract_signed.pdf',
        downloadUrl:
          'https://yourdomain.com/smart-ca/download/contract_signed.pdf',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook data',
  })
  @Post('webhook/callback')
  async handleCaWebhook(@Body() body: VnptWebhookDto) {
    this.logger.log(`[DEBUG-WEBHOOK] Raw Body: ${JSON.stringify(body)}`);

    const { status_code, signed_files, transaction_id, message } = body;

    if (status_code !== 0 && status_code !== 200) {
      this.logger.warn(
        `[DEBUG-WEBHOOK] Giao dịch ${transaction_id} thất bại. CA Message: ${message}`,
      );
      return { status: 'received', detail: 'Transaction failed' };
    }

    if (!signed_files || signed_files.length === 0) {
      this.logger.error(
        `[DEBUG-WEBHOOK] Không tìm thấy signed_files trong body!`,
      );
      return { status: 'received', detail: 'No files found' };
    }

    const file = signed_files[0];
    const parts = file.doc_id.split('|').map((p) => p.trim());

    if (parts.length < 3) {
      this.logger.error(
        `[DEBUG-WEBHOOK] doc_id không đủ thông tin: ${file.doc_id}`,
      );
      return { status: 'received', detail: 'Invalid doc_id structure' };
    }

    const [originalFileName, fileID, transIdHash, contractId] = parts;
    console.log('parts', { fileID, transIdHash, originalFileName, contractId });
    this.logger.log(`[DEBUG-WEBHOOK] Target Hash: ${transIdHash}`);

    try {
      this.logger.log(
        `[DEBUG-WEBHOOK] Step: signExternal - Hash: ${transIdHash}`,
      );
      const finalData = await this.smartCaService.signExternal(
        transIdHash,
        fileID,
        file.signature_value,
      );
      if (!finalData.signResps?.length) {
        this.logger.error(
          `[DEBUG-WEBHOOK] signExternal lỗi: ${finalData?.message || 'Không có data'}`,
        );
        return { status: 'received', detail: 'Packaging failed' };
      }
      const signedPdfBase64 = finalData.signResps[0].signedData;
      const fileName = await this.smartCaService.savePdfFile(
        signedPdfBase64,
        originalFileName,
      );

      // this.logger.log(`[LARK] Uploading signed PDF to Lark Drive...`);

      // const larkResult = await this.larkDriveService.uploadSignedPdf(
      //     signedPdfBase64,
      //     fileName,
      // );

      // this.logger.log(`[LARK] Upload thành công: ${larkResult.viewUrl}`);

      this.logger.log(
        `[DEBUG-WEBHOOK] Tự động đóng gói và lưu file THÀNH CÔNG: ${fileName}`,
      );

      const downloadUrl = `${this.be_url}/smart-ca/download/${fileName}`;

      const anycrossPayload = {
        transaction_id: transaction_id,
        fileName: fileName,
        fileContent: signedPdfBase64,
        originalFileName: originalFileName,
        downloadUrl: downloadUrl,
        status: 'success',
        contractId: contractId,
        signedAt: new Date().toISOString(),
      };

      axios
        .post(this.anycross_webhook_url_ben_a, anycrossPayload)
        .then(() =>
          this.logger.log(
            `[ANYCROSS] Đã bắn tin thành công cho file: ${fileName}`,
          ),
        )
        .catch((err) =>
          this.logger.error(`[ANYCROSS] Lỗi khi bắn tin: ${err.message}`),
        );

      return {
        status: 'success',
        message: 'Webhook processed and file saved',
        fileContent: signedPdfBase64,
        originalFileName: originalFileName,
        downloadUrl: `${this.be_url}/smart-ca/download/${fileName}`,
        fileName: fileName,
      };
    } catch (error) {
      this.logger.error(`[DEBUG-WEBHOOK] CRITICAL ERROR: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @ApiOperation({ summary: 'Kiểm tra trạng thái giao dịch ký số' })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction ID trả về từ init-sign',
    example: 'c0aec40c-9adb-4b97-8b00-2ac1cbc6e2c0',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về trạng thái giao dịch',
    type: CheckStatusResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Transaction ID is required',
  })
  @Get('check-status/:transactionId')
  async checkStatus(@Param('transactionId') transactionId: string) {
    this.logger.log(
      `Received check-status request for transaction: ${transactionId}`,
    );
    if (!transactionId) {
      throw new HttpException(
        'Transaction ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const statusData = await this.smartCaService.checkStatus(transactionId);
    return statusData;
  }

  @ApiOperation({ summary: 'Finalize signing process' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        transIdHash: { type: 'string' },
        fileId: { type: 'string' },
        originalFileName: { type: 'string' },
      },
    },
  })
  @Post('finalize-sign')
  async finalizeSign(
    @Body('transactionId') transactionId: string,
    @Body('transIdHash') transIdHash: string,
    @Body('fileId') fileId: string,
    @Body('originalFileName') originalFileName?: string,
  ) {
    this.logger.log(
      `Received finalize-sign request for transaction: ${transactionId}`,
    );
    if (!transactionId || !transIdHash || !fileId) {
      throw new HttpException(
        'Missing required parameters',
        HttpStatus.BAD_REQUEST,
      );
    }

    const statusData = await this.smartCaService.checkStatus(transactionId);

    if (statusData.message !== 'SUCCESS') {
      throw new HttpException(
        'Signature not confirmed yet or failed. Status: ' + statusData.message,
        HttpStatus.BAD_REQUEST,
      );
    }
    this.logger.debug(
      `Signature status response: ${JSON.stringify(statusData)}`,
    );
    const signatureValue = statusData.data.signatures[0].signature_value;

    const finalData = await this.smartCaService.signExternal(
      transIdHash,
      fileId,
      signatureValue,
    );

    const signedPdfBase64 = finalData.signResps[0].signedData;
    const fileName = await this.smartCaService.savePdfFile(
      signedPdfBase64,
      originalFileName,
    );

    return {
      message: 'Signing completed successfully',
      downloadUrl: `${this.be_url}/smart-ca/download/${fileName}`,
      fileName: fileName,
    };
  }

  @ApiOperation({ summary: 'Download signed PDF file' })
  @Get('download/:fileName')
  async downloadFile(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.logger.log(`Download request for file: ${fileName}`);

    if (
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\')
    ) {
      throw new HttpException('Invalid filename', HttpStatus.BAD_REQUEST);
    }

    const filePath = path.join(process.cwd(), 'uploads', fileName);

    try {
      const file = createReadStream(filePath);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });

      return new StreamableFile(file);
    } catch (error) {
      this.logger.error(`Error downloading file: ${fileName}`, error.message);
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
  }

  // @ApiOperation({ summary: 'Initiate signing process (Base64)' })
  // @ApiConsumes('application/json')
  // @ApiBody({ type: InitSignRequestDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Signing initiated successfully',
  //   type: InitSignResponseDto,
  // })
  // @Post('sign-flow')
  // async signFlow(
  //   @Body('fileBase64') fileBase64: string,
  //   @Body('fileName') fileName: string,
  //   @Body('docType') docType: string,
  //   @Body('role') role: string,
  //   @Body('contractId') contractId: string,
  //   @Body('userId') userId: string,
  //   @Body('signerName') signerName: string,
  // ) {
  //   this.logger.log('===== START FULL SIGN FLOW =====');

  //   console.log('INPUT DATA:', {
  //     fileName,
  //     docType,
  //     role,
  //     contractId,
  //     base64Length: fileBase64?.length,
  //   });

  //   // ===== STEP 1 INIT SIGN =====
  //   console.log('STEP 1: INIT SIGN');

  //   const init = await this.initSign(
  //     fileBase64,
  //     fileName,
  //     docType,
  //     role,
  //     contractId,
  //     userId,
  //     signerName,
  //   );

  //   // const init = await this.smartCaService.initSignService(
  //   //     fileBase64,
  //   //     fileName,
  //   //     docType,
  //   //     role,
  //   //     contractId,
  //   //     userId
  //   // );

  //   console.log('INIT SIGN RESULT');

  //   const { transactionId, transIdHash, fileId, originalFileName } = init;

  //   this.logger.log(`TransactionId: ${transactionId}`);

  //   // ===== STEP 2 POLL STATUS =====

  //   console.log('STEP 2: START POLLING CHECK STATUS');

  //   let status: any;
  //   let retry = 0;

  //   while (retry < 20) {
  //     console.log(`Polling attempt: ${retry + 1}`);

  //     await new Promise((r) => setTimeout(r, 3000));

  //     status = await this.smartCaService.checkStatus(transactionId);

  //     console.log('CHECK STATUS RESPONSE:', JSON.stringify(status, null, 2));

  //     if (status.message === 'SUCCESS') {
  //       console.log('SIGNATURE SUCCESS DETECTED');
  //       break;
  //     }

  //     retry++;
  //   }

  //   if (status.message !== 'SUCCESS') {
  //     console.error('SIGNATURE NOT COMPLETED');
  //     throw new HttpException(
  //       'User has not signed yet',
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }

  //   // ===== STEP 3 GET SIGNATURE =====

  //   console.log('STEP 3: EXTRACT SIGNATURE VALUE');

  //   const signature_value = status.data.signatures[0].signature_value;

  //   console.log('SIGNATURE VALUE:', signature_value);

  //   const doc_id = `${originalFileName}|${fileId}|${transIdHash}|${contractId}`;

  //   console.log('DOC_ID GENERATED:', doc_id);

  //   // ===== STEP 4 SIGN EXTERNAL =====

  //   console.log('STEP 4: CALL signExternal');

  //   const finalData = await this.smartCaService.signExternal(
  //     transIdHash,
  //     fileId,
  //     signature_value,
  //   );

  //   // console.log('SIGN EXTERNAL RESULT:', JSON.stringify(finalData, null, 2));

  //   const signedPdfBase64 = finalData.signResps[0].signedData;

  //   // console.log('SIGNED PDF BASE64 LENGTH:', signedPdfBase64.length);

  //   const savedFileName = await this.smartCaService.savePdfFile(
  //     signedPdfBase64,
  //     originalFileName,
  //   );

  //   console.log('FILE SAVED:', savedFileName);

  //   const downloadUrl = `${this.be_url}/smart-ca/download/${savedFileName}`;

  //   console.log('DOWNLOAD URL:', downloadUrl);

  //   // ===== STEP 5: CALLBACK =====
  //   console.log('STEP 5: CALLBACK THEO ROLE (BEN_A / BEN_B)');

  //   const payload = {
  //     transaction_id: transactionId,
  //     fileName: savedFileName,
  //     fileContent: signedPdfBase64,
  //     originalFileName,
  //     downloadUrl,
  //     status: 'success',
  //     contractId,
  //     signedAt: new Date().toISOString(),
  //     role,
  //   };

  //   let webhookUrl: string | null = null;
  //   let callbackName = 'Unknown';

  //   const normalizedRole = role?.toUpperCase().trim();

  //   if (normalizedRole === 'BEN_A') {
  //     webhookUrl = this.anycross_webhook_url_ben_a;
  //     callbackName = 'BEN_A';
  //   } else if (normalizedRole === 'BEN_B') {
  //     webhookUrl = this.anycross_webhook_url_ben_b;
  //     callbackName = 'BEN_B';
  //   } else {
  //     this.logger.warn(
  //       `Không hỗ trợ callback cho role: ${role || 'undefined'}`,
  //     );
  //   }

  //   if (webhookUrl) {
  //     try {
  //       const response = await axios.post(webhookUrl, payload, {
  //         timeout: 10000, // tránh treo nếu webhook chậm
  //         headers: { 'Content-Type': 'application/json' },
  //       });

  //       this.logger.log(
  //         `${callbackName} CALLBACK SUCCESS - Status: ${response.status}`,
  //       );
  //     } catch (err) {
  //       const errorMsg = err.response
  //         ? `${err.response.status} - ${JSON.stringify(err.response.data)}`
  //         : err.message;

  //       console.error(`${callbackName} CALLBACK ERROR:`, errorMsg);
  //       this.logger.error(`${callbackName} CALLBACK ERROR: ${errorMsg}`);
  //     }
  //   } else {
  //     this.logger.log('Bỏ qua callback vì role không khớp hoặc không có URL');
  //   }

  //   console.log('===== SIGN FLOW COMPLETED =====');

  //   return {
  //     message: 'Signing completed',
  //     transactionId,
  //     doc_id,
  //     contractId,
  //     signature_value,
  //     downloadUrl,
  //   };
  // }

  @ApiOperation({ summary: 'Initiate signing process (Base64)' })
  @ApiConsumes('application/json')
  @ApiBody({ type: InitSignRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Signing initiated successfully',
    type: InitSignResponseDto,
  })
  @Post('sign-flow')
  async signFlow(
  @Body('fileBase64') fileBase64: string,
  @Body('fileName') fileName: string,
  @Body('docType') docType: string,
  @Body('role') role: string,
  @Body('contractId') contractId: string,
  @Body('userId') userId: string,
  // @Body('signerName') signerName: string,
) {
  this.logger.log('===== START SIGN FLOW API =====');

  const result = await this.smartCaService.signFlowService(
    fileBase64,
    fileName,
    docType,
    role,
    contractId,
    userId,
    // signerName,
  );

  const {
    transactionId,
    signedPdfBase64,
    savedFileName,
    originalFileName,
  } = result;

  const downloadUrl = `${this.be_url}/smart-ca/download/${savedFileName}`;

  const payload = {
    transaction_id: transactionId,
    fileName: savedFileName,
    fileContent: signedPdfBase64,
    originalFileName,
    downloadUrl,
    status: 'success',
    contractId,
    signedAt: new Date().toISOString(),
    role,
  };

  let webhookUrl: string | null = null;

  const normalizedRole = role?.toUpperCase().trim();
  this.logger.debug('normalizedRole', normalizedRole)
  if (normalizedRole === 'BEN_A') {
    webhookUrl = this.anycross_webhook_url_ben_a;
  } else if (normalizedRole === 'BEN_B') {
    webhookUrl = this.anycross_webhook_url_ben_b;
  }

  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, payload, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });

      this.logger.log(`CALLBACK SUCCESS`);
    } catch (err) {
      this.logger.error(`CALLBACK ERROR: ${err.message}`);
    }
  }

  return {
    message: 'Signing completed',
    transactionId,
    signedPdfBase64: signedPdfBase64,
    contractId,
    downloadUrl,
  };
}
}
