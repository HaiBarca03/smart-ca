import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../constants/doc-type.enum';

export class InitSignRequestDto {
  @ApiProperty({
    description: 'Base64 encoded PDF file',
    example: 'JVBERi0xLjQKJcfs...',
  })
  @IsString()
  @IsNotEmpty()
  fileBase64: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'contract.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({
    description: 'Document template type',
    enum: DocumentType,
    example: DocumentType.HSH_HDKXD,
  })
  @IsEnum(DocumentType)
  docType: DocumentType;

  @ApiProperty({
    description: 'Signer role',
    example: 'BEN_A',
  })
  @IsString()
  role: string;
}