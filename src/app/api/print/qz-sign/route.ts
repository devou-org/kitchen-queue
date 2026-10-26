import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function getPrivateKey(): string | null {
  if (process.env.QZ_PRIVATE_KEY) {
    return process.env.QZ_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  const keyCandidates = [
    path.join(process.cwd(), 'certs', 'private-key.pem'),
    path.join(process.cwd(), 'certs', 'private-key.key'),
    path.join(process.cwd(), 'certs', 'private-key.txt'),
  ];

  for (const file of keyCandidates) {
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8');
    }
  }

  return null;
}

function signRequest(toSign: string): string {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error('Private key not found in certs directory or env variable');
  }

  const signer = crypto.createSign('SHA512');
  signer.update(toSign);
  return signer.sign(privateKey, 'base64');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const toSign = searchParams.get('request');
    if (!toSign) {
      return new NextResponse('Missing request parameter', { status: 400 });
    }

    const signature = signRequest(toSign);
    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err: any) {
    console.error('QZ Tray signing error:', err);
    return new NextResponse(err.message || 'Signing failed', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const toSign = await request.text();
    if (!toSign) {
      return new NextResponse('Empty request body', { status: 400 });
    }

    const signature = signRequest(toSign);
    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err: any) {
    console.error('QZ Tray signing error:', err);
    return new NextResponse(err.message || 'Signing failed', { status: 500 });
  }
}
