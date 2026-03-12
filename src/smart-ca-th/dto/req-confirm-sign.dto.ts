import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmSignRequestDto {
  @ApiProperty({
    example: 'a71bf8ad-71ad-4823-b586-33c8698b768e',
    description: 'Transaction ID trả về từ API init-sign',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...',
    description: 'SAD token trả về từ SmartCA sign API',
  })
  @IsString()
  @IsNotEmpty()
  sad: string;

  @ApiProperty({
    example: '012345678901',
    description: 'User ID của thuê bao SmartCA',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'e1f1c7d1-abc123',
    description: 'Transaction ID của bước hash',
  })
  @IsString()
  @IsNotEmpty()
  transIdHash: string;

  @ApiProperty({
    example: 'file_123456',
    description: 'File ID trả về từ API calculateHash',
  })
  @IsString()
  @IsNotEmpty()
  fileID: string;

  @ApiProperty({
    example: 'contract.pdf',
    description: 'Tên file gốc',
  })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiProperty({
    example: 'CONTRACT_001',
    description: 'ID hợp đồng',
  })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    example: 'BEN_A',
    description: 'Role của người ký',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}
