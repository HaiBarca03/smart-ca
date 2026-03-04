import { ApiProperty } from '@nestjs/swagger';

export class CheckStatusSignatureDto {

  @ApiProperty({
    example: 'hop_dong_mua_ban.pdf|eea2b5ec-60d4-44b6-b046-6eae23e59e6b|1c1d73396f714573a68f94e74ac21736',
  })
  doc_id: string;

  @ApiProperty({
    example: 'cqtmElMvJNAC+/Az91gQwwNchwpvQFkN/frJiXyR5v7liSSj9cSgLKf+bNpDMKu+FSIY/rYMMeEa1RcdMjXHf8fqZvrn/G9MjSrA/+PqKV4QQRFOriqzWcD2OZV1soaYpQrfmdFR5KYKYDQov4Mur8dvTrWDtGc/oqOxeJPqifl9a7VmV3pGcRHrbzGbXD1SrJfKJw4edj0iooB0U8udKudFNwkAzSf5o1Tzk2JN9VK8Wp1iUjjrAlgsYFxReJeYrLCLw6KJZV4/peSyRyBzuT4Mi02CmLdgu67ZHTXtqwZ3NnF/7whw4R5mSpzXhlSShvkwwJ3DL8D3IgoNQFDPWg==',
  })
  signature_value: string;

  @ApiProperty({
    example: null,
    nullable: true,
  })
  timestamp_signature: string | null;
}