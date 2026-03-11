import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CalculateHashDto, SignExternalDto, SignHashDto } from './dto/smart-ca.dto';
import { PDFDocument } from 'pdf-lib';
import { SIGNATURE_TEMPLATES, SignatureDetail } from './constants/signature-config';

@Injectable()
export class SmartCaService {
    private readonly logger = new Logger(SmartCaService.name);
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly userId: string;
    private readonly baseUrl: string;
    private readonly restUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.clientId = this.configService.get<string>('SMARTCA_CLIENT_ID') ?? '';
        this.clientSecret = this.configService.get<string>('SMARTCA_CLIENT_SECRET') ?? '';
        // this.userId = this.configService.get<string>('SMARTCA_USER_ID') ?? '';
        this.baseUrl = this.configService.get<string>('SMARTCA_BASE_URL') ?? '';
        this.restUrl = this.configService.get<string>('SMARTCA_REST_URL') ?? '';
    }

    private getTransactionId(): string {
        return uuidv4();
    }

    async getCertificate(userId: string) {
        this.logger.log('Getting certificate from SmartCA');
        console.log('Getting certificate for userId:', userId);
        const url = `${this.baseUrl}/credentials/get_certificate`;
        const data = {
            sp_id: this.clientId,
            sp_password: this.clientSecret,
            // user_id: this.userId,
            user_id: userId,
            transaction_id: this.getTransactionId(),
        };

        try {
            const response = await firstValueFrom(this.httpService.post(url, data)) as AxiosResponse<any>;
            return response.data;
        } catch (error) {
            this.logger.error('Error getting certificate', error.response?.data || error.message);
            throw new HttpException('Failed to get certificate', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async calculateHash(
            pdfBase64: string, 
            certBase64: string, 
            docType: string, 
            role: string, 
            // signerName: string
        ) {
        this.logger.debug(`Certificate: ${certBase64.substring(0, 50)}...`);
        const url = `${this.restUrl}/signature/calculateHash`;
        this.logger.log('Calculating hash for document: ' + url);
        const cleanCert = certBase64.replace(/[\r\n]/g, '');
        const docTemplate = SIGNATURE_TEMPLATES[docType]
        if (!docTemplate) {
            throw new Error(`Không tìm thấy cấu hình cho loại tài liệu: ${docType}`);
        }
        const config: SignatureDetail = docTemplate[role]
        if (!config) {
            throw new Error(`Không tìm thấy tọa độ ký cho vai trò: ${role}`);
        }
        let targetPage = config.page;

        const now = new Date();
        const dateStr = now.toLocaleDateString('vi-VN', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        const timeStr = now.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });

        const signatureText = 
            `Verified by: VNPT SmartCA\n` +
            // `Signed by: ${signerName}\n` +
            `Signed date: ${dateStr} ${timeStr}`;

        const data: CalculateHashDto = {
            transaction_id: this.getTransactionId(),
            sp_id: this.clientId,
            sp_password: this.clientSecret,
            signerCert: cleanCert,
            digestAlgorithm: 'sha256',
            sign_files: [
                {
                    storage_file_name: '',
                    pdfContent: pdfBase64,
                    sigOptions: {
                        // renderMode: 3,
                        renderMode: 1, 
                        fontSize: 8, 
                        fontColor: "FF0000",
                        // signatureText: signatureText,
                        signatures: [
                            {
                                page: targetPage, 
                                rectangle: config.rectangle, 
                            },
                        ],
                    },
                },
            ],
        };
        // this.logger.debug(`Calculate hash data: ${JSON.stringify(data)}`);
        try {
            const response = await firstValueFrom(this.httpService.post(url, data)) as AxiosResponse<any>;
            this.logger.debug(`Calculate hash response: ${JSON.stringify(response.data)}`);
            if (response.data?.hashResps?.[0]?.code !== 'sigSuccess') {
                throw new Error('Hash calculation failed: ' + JSON.stringify(response.data));
            }
            return response.data;
        } catch (error: any) {
            this.logger.error('Error calculating hash', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
                requestUrl: url,
                requestBody: JSON.stringify(data, null, 2).substring(0, 2000) + '...', // truncate if too big
            });

            if (error.response) {
                // Server responded with non-2xx
                throw new HttpException(
                    {
                        message: 'SmartCA calculateHash failed',
                        status: error.response.status,
                        detail: error.response.data || 'No detail provided',
                    },
                    HttpStatus.BAD_GATEWAY, // 502
                );
            } else if (error.request) {
                this.logger.error('No response from SmartCA calculateHash', error.request);
                throw new HttpException('SmartCA service unreachable', HttpStatus.GATEWAY_TIMEOUT);
            } else {
                throw error;
            }
        }
    }

    async signHash(hash: string, serialNumber: string, docIdPayload: string, userId: string) {
        this.logger.log(`[DEBUG] Step 3: Signing Hash. Payload: ${docIdPayload}`);
        const url = `${this.baseUrl}/signatures/sign`;

        // Chuyển đổi hash sang Hex theo yêu cầu VNPT
        const dataToBeSigned = Buffer.from(hash, 'base64').toString('hex');
        
        const data: any = {
            sp_id: this.clientId,
            sp_password: this.clientSecret,
            // user_id: this.userId,
            user_id: userId,
            transaction_id: this.getTransactionId(),
            sign_files: [
                {
                    data_to_be_signed: dataToBeSigned,
                    doc_id: docIdPayload, 
                    file_type: 'pdf',
                    sign_type: 'hash',
                },
            ],
            serial_number: serialNumber,
        };

        try {
            const response = await firstValueFrom(this.httpService.post(url, data)) as AxiosResponse<any>;
            this.logger.debug(`[DEBUG] Sign Hash Response: ${JSON.stringify(response.data)}`);

            if (response.data?.status_code !== 200) {
                throw new Error(`VNPT rejected signHash: ${response.data?.message}`);
            }
            
            return response.data;
        } catch (error) {
            this.logger.error('[DEBUG] Error in signHash', error.response?.data || error.message);
            throw new HttpException('Failed to sign hash', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async checkStatus(tranId: string) {
        this.logger.debug(`Checking status for transaction: ${tranId}`);
        const url = `${this.baseUrl}/signatures/sign/${tranId}/status`;
        try {
            const response = await firstValueFrom(this.httpService.post(url, {})) as AxiosResponse<any>;
            return response.data;
        } catch (error) {
            this.logger.error('Error checking status', error.response?.data || error.message);
            throw new HttpException('Failed to check status', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async signExternal(transIdHash: string, fileId: string, signatureValue: string) {
        this.logger.log(`[DEBUG] Step 5: Sign External. TransIdHash: ${transIdHash}, FileID: ${fileId}`);
        const url = `${this.restUrl}/signature/signExternal`;
        const data: SignExternalDto = {
            tranId: transIdHash,
            sp_id: this.clientId,
            sp_password: this.clientSecret,
            signatures: [
                {
                    fileID: fileId,
                    signature: signatureValue,
                },
            ],
        };

        try {
            const response = await firstValueFrom(this.httpService.post(url, data)) as AxiosResponse<any>;
            return response.data;
        } catch (error) {
            this.logger.error('[DEBUG] Error in signExternal', error.response?.data || error.message);
            throw new HttpException('Failed to sign external', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async savePdfFile(base64Data: string, originalFileName?: string): Promise<string> {
        try {
            const uploadsDir = path.join(process.cwd(), 'uploads');
            await fs.mkdir(uploadsDir, { recursive: true });

            const timestamp = Date.now();
            const randomId = uuidv4().substring(0, 8);
            
            // Làm sạch tên file để tránh lỗi hệ thống
            const baseName = originalFileName
                ? originalFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')
                : 'signed_doc';
                
            const fileName = `${baseName}_${timestamp}_${randomId}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            const buffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(filePath, buffer);

            this.logger.log(`[DEBUG] Step 6: PDF saved successfully at: ${filePath}`);
            return fileName;
        } catch (error) {
            this.logger.error('[DEBUG] Error saving PDF file', error.message);
            throw new HttpException('Failed to save PDF file', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
