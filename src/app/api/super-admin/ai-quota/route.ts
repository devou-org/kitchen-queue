import { NextRequest, NextResponse } from 'next/server';
import { AIRepository } from '@/modules/ai/ai.repository';

export async function GET(request: NextRequest) {
  try {
    const overview = await AIRepository.getSuperAdminOverview();
    return NextResponse.json({
      success: true,
      data: overview
    });
  } catch (error: any) {
    console.error('Error fetching Super Admin AI overview:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch AI quota metrics' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, tokens_per_credit, is_enabled } = body;

    const updated = await AIRepository.updateGlobalConfig({
      model,
      rpm_limit: rpm_limit ? parseInt(rpm_limit, 10) : undefined,
      tpm_limit: tpm_limit ? parseInt(tpm_limit, 10) : undefined,
      rpd_limit: rpd_limit ? parseInt(rpd_limit, 10) : undefined,
      max_output_tokens: max_output_tokens ? parseInt(max_output_tokens, 10) : undefined,
      tokens_per_credit: tokens_per_credit ? parseInt(tokens_per_credit, 10) : undefined,
      is_enabled: typeof is_enabled === 'boolean' ? is_enabled : undefined
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Global Gemini configuration updated successfully.'
    });
  } catch (error: any) {
    console.error('Error updating Super Admin AI config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update AI config' },
      { status: 500 }
    );
  }
}
