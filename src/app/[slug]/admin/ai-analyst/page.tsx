'use client';

import React from 'react';
import { AIAnalystWidget } from '@/components/ai/AIAnalystWidget';
import { Bot } from 'lucide-react';

export default function AIAnalystPage() {
  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '20px',
        background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '40px auto 20px', boxShadow: '0 10px 30px rgba(5, 150, 105, 0.3)'
      }}>
        <Bot size={36} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
        Qdine AI Business Analyst
      </h1>
      <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '500px', margin: '0 auto 24px' }}>
        Click the floating button on the bottom-right of your screen to open the AI Analyst widget from any admin page!
      </p>

      {/* Render AI widget open by default */}
      <AIAnalystWidget defaultOpen={true} />
    </div>
  );
}
