import { ApiProperty } from '@nestjs/swagger';

export class SignedFileDto {

  @ApiProperty({
    description: 'Document ID chứa originalFileName|fileID|transIdHash',
    example: 'contract.pdf|abc123|tran456',
  })
  doc_id: string;

  @ApiProperty({
    description: 'Chữ ký số trả về từ CA (Base64)',
    example: 'MEUCIQDf...',
  })
  signature_value: string;

  @ApiProperty({
    description: 'Timestamp signature (nếu có)',
    example: '2024-07-20T10:00:00Z',
    required: false,
  })
  timestamp_signature?: string;
}