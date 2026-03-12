import { Type } from 'class-transformer';
import { CheckStatusSignatureDto } from './res-check-status-signature.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CheckStatusDataDto {
  @ApiProperty({
    example: 'c0aec40c-9adb-4b97-8b00-2ac1cbc6e2c0',
  })
  transaction_id: string;

  @ApiProperty({
    description: 'Số giây còn lại trước khi hết hạn',
    example: 279,
  })
  expired_in: number;

  @ApiProperty({
    type: [CheckStatusSignatureDto],
  })
  @Type(() => CheckStatusSignatureDto)
  signatures: CheckStatusSignatureDto[];
}
