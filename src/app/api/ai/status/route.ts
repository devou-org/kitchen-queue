import { NextResponse } from 'next/server';
import { AIRepository } from '@/modules/ai/ai.repository';

export async function GET() {
  try {
    const config = await AIRepository.getGlobalConfig();
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyRes = await AIRepository.getSuperAdminOverview();
    
    const isConfigEnabled = config.is_enabled;
    const isDailyEnabled = dailyRes.dailyUsage.is_enabled;
    const isEnabled = isConfigEnabled && isDailyEnabled;

    let disabledReason: string | null = null;
    if (!isConfigEnabled) {
      disabledReason = 'AI service disabled by administrator.';
    } else if (!isDailyEnabled) {
      disabledReason = `Daily limit reached (${dailyRes.dailyUsage.disabled_reason || 'Quota exceeded'}).`;
    }

    return NextResponse.json({
      success: true,
      is_enabled: isEnabled,
      disabled_reason: disabledReason
    });
  } catch (error: any) {
    console.error('Error fetching AI status:', error);
    return NextResponse.json(
      { success: true, is_enabled: true, disabled_reason: null },
      { status: 200 }
    );
  }
}
