import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 1. Check env variable first
    if (process.env.QZ_CERTIFICATE) {
      return new NextResponse(process.env.QZ_CERTIFICATE.replace(/\\n/g, '\n'), {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 2. Check certs directory
    const certCandidates = [
      path.join(process.cwd(), 'certs', 'digital-certificate.txt'),
      path.join(process.cwd(), 'certs', 'digital-certificate'),
      path.join(process.cwd(), 'certs', 'digital-certificate.pem'),
      path.join(process.cwd(), 'certs', 'override.crt'),
    ];

    for (const file of certCandidates) {
      if (fs.existsSync(file)) {
        const cert = fs.readFileSync(file, 'utf8');
        return new NextResponse(cert, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }

    return new NextResponse('Certificate not found', { status: 404 });
  } catch (err: any) {
    return new NextResponse(err.message || 'Error loading certificate', { status: 500 });
  }
}
