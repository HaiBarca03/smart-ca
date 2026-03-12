export class SignedFileDto {
  doc_id: string;
  signature_value: string;
  timestamp_signature?: string;
}

export class VnptWebhookDto {
  sp_id: string;
  status_code: number;
  message: string;
  transaction_id?: string;
  signed_files: SignedFileDto[];
}
