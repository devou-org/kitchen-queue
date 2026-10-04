-- Migration: Qdine AI Business Analyst Chat System
-- Date: 2026-08-23

-- 1. Ensure BUSINESS_ANALYST_CHAT is registered in gemini_request_config with 10,000 max output tokens
INSERT INTO gemini_request_config (request_type, max_output_tokens)
VALUES ('BUSINESS_ANALYST_CHAT', 10000)
ON CONFLICT (request_type) 
DO UPDATE SET max_output_tokens = 10000, updated_at = CURRENT_TIMESTAMP;

-- 2. TABLE: ai_chat_sessions
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Business Analysis Chat',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLE: ai_chat_messages
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'model', 'system', 'tool'
    content TEXT NOT NULL,
    tool_calls JSONB NULL,
    tool_results JSONB NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup of session messages
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_restaurant ON ai_chat_sessions(restaurant_id, updated_at DESC);
