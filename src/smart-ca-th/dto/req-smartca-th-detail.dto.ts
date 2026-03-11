import { ApiProperty } from '@nestjs/swagger';

export class SmartCATHDetailDto {
  @ApiProperty({ example: "https://smartca.viettel.vn" })
  url: string;

  @ApiProperty({ example: "SP123456" })
  sp_id: string;

  @ApiProperty({ example: "password123" })
  sp_password: string;

  @ApiProperty({ example: "001195008601" })
  user_id: string;

  @ApiProperty({ example: "userPassword" })
  password: string;

  @ApiProperty({
    example: "JBSWY3DPEHPK3PXP",
    description: "TOTP secret key"
  })
  totp_secret: string;

  @ApiProperty({
    example: "1234567890ABCDEF",
    required: false
  })
  serial_number?: string;
}

export class SignHashPdfDto {
  @ApiProperty({ type: SmartCATHDetailDto })
  detail: SmartCATHDetailDto;

  @ApiProperty({
    example:
      "A1B2C3D4E5F6...",
    description: "Hash của file PDF (hex)"
  })
  hashHex: string;
}