import { Storage } from '@google-cloud/storage';
import { Readable } from 'stream';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME || '');

export async function uploadToStorage(stream: Readable, filename: string): Promise<string> {
  const blob = bucket.file(`career-pdfs/${Date.now()}-${filename}`);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      contentType: 'application/pdf',
    },
  });

  return new Promise((resolve, reject) => {
    stream
      .pipe(blobStream)
      .on('error', reject)
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      });
  });
} 