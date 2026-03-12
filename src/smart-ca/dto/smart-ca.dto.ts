export class SignFileDto {
  storage_file_name?: string;
  name?: string;
  pdfContent: string; // Base64
  sigOptions: {
    renderMode: number;
    customImage?: string; // Base64
    fontSize?: number;
    fontColor?: string;
    signatureText?: string;
    signatures: {
      page: number;
      rectangle: string;
    }[];
  };
}

export class CalculateHashDto {
  transaction_id: string;
  sp_id: string;
  sp_password?: string;
  signerCert: string;
  digestAlgorithm: string;
  sign_files: SignFileDto[];
}

export class SignHashDto {
  sp_id: string;
  sp_password?: string;
  user_id: string;
  transaction_id: string;
  sign_files: {
    data_to_be_signed: string; // Hex of Hash
    doc_id: string;
    file_type: string;
    sign_type: string;
  }[];
  serial_number: string;
}

export class SignExternalDto {
  tranId: string;
  sp_id: string;
  sp_password?: string;
  signatures: {
    fileID: string;
    signature: string;
  }[];
}
