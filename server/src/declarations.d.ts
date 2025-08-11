// src/declarations.d.ts

// ——— pdf-parse’s internal entrypoint ———
declare module 'pdf-parse/lib/pdf-parse.js' {
  import { Buffer } from 'buffer';
  interface PdfParseResult {
    text: string;
    info: any;
    metadata: any;
    [key: string]: any;
  }
  export default function pdfParse(
    data: Buffer | Uint8Array | ArrayBuffer
  ): Promise<PdfParseResult>;
}

// ——— graphql-upload (MVP only needs the middleware) ———
declare module 'graphql-upload' {
  export function graphqlUploadExpress(options?: {
    maxFileSize?: number;
    maxFiles?: number;
  }): import('express').RequestHandler;
}