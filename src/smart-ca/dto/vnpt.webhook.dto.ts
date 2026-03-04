import { ApiProperty } from "@nestjs/swagger";
import { SignedFileDto } from "./signed-file.dto";

export class VnptWebhookDto {

  @ApiProperty({
    description: 'Service Provider ID',
    example: 'SP123456',
  })
  sp_id: string;

  @ApiProperty({
    description: 'Trạng thái giao dịch (0 hoặc 200 là thành công)',
    example: 0,
  })
  status_code: number;

  @ApiProperty({
    description: 'Thông báo từ CA',
    example: 'Success',
  })
  message: string;

  @ApiProperty({
    description: 'Transaction ID từ CA',
    example: 'TRANS123456',
    required: false,
  })
  transaction_id?: string;

  @ApiProperty({
    description: 'Danh sách file đã ký',
    type: [SignedFileDto],
  })
  signed_files: SignedFileDto[];
}