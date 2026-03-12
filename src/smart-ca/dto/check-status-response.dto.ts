import { ApiProperty } from '@nestjs/swagger';
import { CheckStatusDataDto } from './check-status-data.dto';

export class CheckStatusResponseDto {
  @ApiProperty({
    example: 200,
  })
  status_code: number;

  @ApiProperty({
    example: 'SUCCESS',
  })
  message: string;

  @ApiProperty({
    type: CheckStatusDataDto,
  })
  data: CheckStatusDataDto;
}
