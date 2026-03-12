import { ApiProperty } from '@nestjs/swagger';

export class InitSignDataDto {
  @ApiProperty({
    example: '9cf110d8-ceab-46b8-9886-f7ee25068fea',
  })
  transactionId: string;

  @ApiProperty({
    example: '1ca4cd63aa0749b2889b52dc51cedd91',
  })
  transIdHash: string;

  @ApiProperty({
    example: 'c3687fad-c8ea-47f7-a1ed-def0d448c10b',
  })
  fileId: string;

  @ApiProperty({
    example: 'hop_dong_mua_ban.pdf',
  })
  originalFileName: string;
}

export class InitSignResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'Signing initiated. Please confirm on mobile app.',
  })
  message: string;

  @ApiProperty({ type: InitSignDataDto })
  data: InitSignDataDto;
}
