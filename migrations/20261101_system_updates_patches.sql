-- System Updates and Patches Table
CREATE TABLE IF NOT EXISTS system_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag VARCHAR(50) NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    learn_more_url TEXT NULL,
    is_published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_updates_published ON system_updates(is_published, published_at DESC);

