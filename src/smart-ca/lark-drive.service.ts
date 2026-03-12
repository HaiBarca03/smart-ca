import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

interface TenantTokenResponse {
  tenant_access_token: string;
  expire: number;
}

interface UploadResponse {
  data?: {
    file_token?: string;
  };
}

@Injectable()
export class LarkDriveService {
  private readonly logger = new Logger(LarkDriveService.name);
  private readonly http: AxiosInstance;

  private tenantToken: string | null = null;
  private tokenExpireAt = 0;

  private readonly APP_ID: string;
  private readonly APP_SECRET: string;
  private readonly SIGNED_FOLDER_TOKEN: string;

  constructor() {
    // ===== Validate ENV =====
    if (!process.env.LARK_APP_ID) {
      throw new Error('LARK_APP_ID is not defined');
    }

    if (!process.env.LARK_APP_SECRET) {
      throw new Error('LARK_APP_SECRET is not defined');
    }

    if (!process.env.LARK_SIGNED_FOLDER) {
      throw new Error('LARK_SIGNED_FOLDER is not defined');
    }

    this.APP_ID = process.env.LARK_APP_ID;
    this.APP_SECRET = process.env.LARK_APP_SECRET;
    this.SIGNED_FOLDER_TOKEN = process.env.LARK_SIGNED_FOLDER;

    this.http = axios.create({
      baseURL: 'https://open.larksuite.com',
      timeout: 15000,
    });
  }

  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.tenantToken && now < this.tokenExpireAt) {
      return this.tenantToken;
    }

    try {
      const { data } = await this.http.post<TenantTokenResponse>(
        '/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: this.APP_ID,
          app_secret: this.APP_SECRET,
        },
      );

      this.tenantToken = data.tenant_access_token;
      this.tokenExpireAt = now + (data.expire - 60) * 1000;

      this.logger.log('[LARK] New tenant_access_token acquired');

      return this.tenantToken;
    } catch (error) {
      this.logger.error('[LARK] Failed to get tenant token', error);
      throw new InternalServerErrorException('Cannot get Lark tenant token');
    }
  }

  async uploadSignedPdf(
    base64Pdf: string,
    fileName: string,
  ): Promise<{
    fileToken: string;
    viewUrl: string;
  }> {
    const token = await this.getTenantAccessToken();

    // remove base64 header nếu có
    const cleanedBase64 = base64Pdf.replace(
      /^data:application\/pdf;base64,/,
      '',
    );

    const buffer = Buffer.from(cleanedBase64, 'base64');

    const formData = new FormData();

    formData.append('file_name', fileName);
    formData.append('parent_type', 'explorer');
    formData.append('parent_node', this.SIGNED_FOLDER_TOKEN);
    formData.append('size', buffer.length.toString()); // 🔥 BẮT BUỘC THEO PYTHON

    formData.append('file', buffer, {
      filename: fileName,
      contentType: 'application/pdf',
    });

    try {
      const response = await this.http.post(
        '/open-apis/drive/v1/files/upload_all',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...formData.getHeaders(),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );

      const fileToken = response.data?.data?.file_token;

      if (!fileToken) {
        this.logger.error('LARK RESPONSE:', response.data);
        throw new Error('No file_token returned');
      }

      return {
        fileToken,
        viewUrl: `https://drive.larksuite.com/file/${fileToken}`,
      };
    } catch (error: any) {
      console.error('LARK ERROR RESPONSE:', error?.response?.data);
      throw new InternalServerErrorException('Upload to Lark failed');
    }
  }
}
