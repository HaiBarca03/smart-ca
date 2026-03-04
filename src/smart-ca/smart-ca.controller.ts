import { Controller, Post, Body, HttpException, HttpStatus, UseInterceptors, UploadedFile, Logger, Get, Param, Res, StreamableFile, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import * as path from 'path';
import { SmartCaService } from './smart-ca.service';
import { removeVietnameseTones } from 'src/utils/text.util';
import { VnptWebhookDto } from './dto/res-smart-ca.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LarkDriveService } from './lark-drive.service';

@ApiTags('smart-ca')
@Controller('smart-ca')
export class SmartCaController {
    private readonly logger = new Logger(SmartCaController.name);
    private readonly be_url: string;
    private readonly anycross_webhook_url: string;

    constructor(
        private readonly smartCaService: SmartCaService, 
        private readonly configService: ConfigService,
        private larkDriveService: LarkDriveService
    ) { 
        this.be_url = this.configService.get<string>('BE_URL') ?? '';
        this.anycross_webhook_url = this.configService.get<string>('ANYCROSS_WEB_HOOK_URL') ?? '';
    }

    @ApiOperation({ summary: 'Initiate signing process' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @Post('init-sign')
    async initSign(
        @Body('fileBase64') fileBase64: string, 
        @Body('fileName') fileName: string,     
        @Body('docType') docType: string,
        @Body('role') role: string,
        @Body('signerName') signerName: string,
    ) {
        this.logger.log('Received init-sign request with Base64');

        if (!fileBase64) {
            throw new HttpException('Base64 file string is required', HttpStatus.BAD_REQUEST);
        }

        const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, '');
        
        const originalName = fileName || 'document.pdf';
        const docId = removeVietnameseTones(originalName);

        // 1. Get Certificate
        const certData = await this.smartCaService.getCertificate();
        const userCert = certData.data.user_certificates[0];
        const certBase64 = userCert.cert_data;
        const serialNumber = userCert.serial_number;

        // 2. Calculate Hash (Sử dụng cleanBase64 trực tiếp)
        const hashData = await this.smartCaService.calculateHash(cleanBase64, certBase64, docType, role, signerName);
        const hash = hashData.hashResps[0].hash;
        const fileID = hashData.hashResps[0].fileID;
        const transIdHash = hashData.tranId;
        const docIdPayload = `${originalName}|${fileID}|${transIdHash}`;

        // 3. Sign Hash
        const signData = await this.smartCaService.signHash(hash, serialNumber, docIdPayload);
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

        return result;
    }

    // Webhook to receive signed document info from CA
    @ApiOperation({ summary: 'API webhook nhận thông tin ký số từ CA' })
    @Post('webhook/callback')
    async handleCaWebhook(@Body() body: VnptWebhookDto) {
        this.logger.log(`[DEBUG-WEBHOOK] Raw Body: ${JSON.stringify(body)}`);

        const { status_code, signed_files, transaction_id, message } = body;

        if (status_code !== 0 && status_code !== 200) {
            this.logger.warn(`[DEBUG-WEBHOOK] Giao dịch ${transaction_id} thất bại. CA Message: ${message}`);
            return { status: 'received', detail: 'Transaction failed' };
        }

        if (!signed_files || signed_files.length === 0) {
            this.logger.error(`[DEBUG-WEBHOOK] Không tìm thấy signed_files trong body!`);
            return { status: 'received', detail: 'No files found' };
        }

        const file = signed_files[0];
        const parts = file.doc_id.split('|').map(p => p.trim());
    
        if (parts.length < 3) {
            this.logger.error(`[DEBUG-WEBHOOK] doc_id không đủ thông tin: ${file.doc_id}`);
            return { status: 'received', detail: 'Invalid doc_id structure' };
        }

        const [originalFileName, fileID, transIdHash] = parts;
        console.log('parts', { fileID, transIdHash, originalFileName });
        this.logger.log(`[DEBUG-WEBHOOK] Target Hash: ${transIdHash}`);

        try {
            this.logger.log(`[DEBUG-WEBHOOK] Step: signExternal - Hash: ${transIdHash}`);
            const finalData = await this.smartCaService.signExternal(
                transIdHash, 
                fileID, 
                file.signature_value
            );
            if (!finalData.signResps?.length) {
                this.logger.error(`[DEBUG-WEBHOOK] signExternal lỗi: ${finalData?.message || 'Không có data'}`);
                return { status: 'received', detail: 'Packaging failed' };
            }
            const signedPdfBase64 = finalData.signResps[0].signedData;
            const fileName = await this.smartCaService.savePdfFile(
                signedPdfBase64, 
                originalFileName
            );

            // this.logger.log(`[LARK] Uploading signed PDF to Lark Drive...`);

            // const larkResult = await this.larkDriveService.uploadSignedPdf(
            //     signedPdfBase64,
            //     fileName,
            // );

            // this.logger.log(`[LARK] Upload thành công: ${larkResult.viewUrl}`);

            this.logger.log(`[DEBUG-WEBHOOK] Tự động đóng gói và lưu file THÀNH CÔNG: ${fileName}`);
        
            const downloadUrl = `${this.be_url}/smart-ca/download/${fileName}`;

            const anycrossPayload = {
                transaction_id: transaction_id,
                fileName: fileName,
                fileContent: signedPdfBase64,
                originalFileName: originalFileName,
                downloadUrl: downloadUrl,
                status: 'success',
                signedAt: new Date().toISOString()
            };

            axios.post(this.anycross_webhook_url, anycrossPayload)
            .then(() => this.logger.log(`[ANYCROSS] Đã bắn tin thành công cho file: ${fileName}`))
            .catch(err => this.logger.error(`[ANYCROSS] Lỗi khi bắn tin: ${err.message}`));

            return { 
                status: 'success', 
                message: 'Webhook processed and file saved',
                fileContent: signedPdfBase64,
                originalFileName: originalFileName,
                downloadUrl: `${this.be_url}/smart-ca/download/${fileName}`,
                fileName: fileName 
            };

        } catch (error) {
            this.logger.error(`[DEBUG-WEBHOOK] CRITICAL ERROR: ${error.message}`);
            return { status: 'error', message: error.message };
        }
    }



    
    @Get('check-status/:transactionId')
    async checkStatus(@Param('transactionId') transactionId: string) {
        this.logger.log(`Received check-status request for transaction: ${transactionId}`);
        if (!transactionId) {
            throw new HttpException('Transaction ID is required', HttpStatus.BAD_REQUEST);
        }
        const statusData = await this.smartCaService.checkStatus(transactionId);
        return statusData;
    }

    @ApiOperation({ summary: 'Finalize signing process' })
    @ApiBody({ schema: { type: 'object', properties: { transactionId: { type: 'string' }, transIdHash: { type: 'string' }, fileId: { type: 'string' }, originalFileName: { type: 'string' } } } })
    @Post('finalize-sign')
    async finalizeSign(
        @Body('transactionId') transactionId: string,
        @Body('transIdHash') transIdHash: string,
        @Body('fileId') fileId: string,
        @Body('originalFileName') originalFileName?: string,
    ) {
        this.logger.log(`Received finalize-sign request for transaction: ${transactionId}`);
        if (!transactionId || !transIdHash || !fileId) {
            throw new HttpException('Missing required parameters', HttpStatus.BAD_REQUEST);
        }

        const statusData = await this.smartCaService.checkStatus(transactionId);

        if (statusData.message !== 'SUCCESS') {
            throw new HttpException(
                'Signature not confirmed yet or failed. Status: ' + statusData.message,
                HttpStatus.BAD_REQUEST,
            );
        }
        this.logger.debug(`Signature status response: ${JSON.stringify(statusData)}`);
        const signatureValue = statusData.data.signatures[0].signature_value;

        const finalData = await this.smartCaService.signExternal(transIdHash, fileId, signatureValue);

        const signedPdfBase64 = finalData.signResps[0].signedData;
        const fileName = await this.smartCaService.savePdfFile(signedPdfBase64, originalFileName);

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

        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
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
}
