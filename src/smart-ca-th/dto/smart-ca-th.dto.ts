export class SmartCATHDetailDto {
  url: string;
  sp_id: string;
  sp_password: string;
  user_id: string;
  password: string;
  totp_secret: string; // Tương đương TOTP trong Java
  serial_number?: string;
}

export class SignHashPdfDto {
  detail: SmartCATHDetailDto;
  file_base64: string;
  page: string;
  rectangle: string;
  visible_type: number;
  full_name: string;
  font_size: number;
  image_src_base64: string;
}
