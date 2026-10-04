-- Weather & Holidays Migration for Qdine AI Analyst

-- 1. Add Location Columns to Restaurants Table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT 'IN',
ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Kerala',
ADD COLUMN IF NOT EXISTS state_code VARCHAR(20) DEFAULT 'KL',
ADD COLUMN IF NOT EXISTS district VARCHAR(100) DEFAULT 'Kannur',
ADD COLUMN IF NOT EXISTS city VARCHAR(150) DEFAULT 'Thalassery',
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7) DEFAULT 11.7750435,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7) DEFAULT 75.496864,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Asia/Kolkata';

-- 2. Create Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(10) NOT NULL,
    state_code VARCHAR(20),
    district VARCHAR(100),
    city VARCHAR(150),
    name VARCHAR(255) NOT NULL,
    holiday_date DATE NOT NULL,
    holiday_type VARCHAR(50),
    is_public_holiday BOOLEAN DEFAULT TRUE,
    source VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_holiday_date_name_location UNIQUE (country_code, state_code, name, holiday_date)
);

-- 3. Create Weather Hourly Cache Table
CREATE TABLE IF NOT EXISTS weather_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    weather_date DATE NOT NULL,
    hour TIMESTAMPTZ NOT NULL,
    temperature_celsius DECIMAL(5,2),
    precipitation_mm DECIMAL(8,2),
    rain_mm DECIMAL(8,2),
    precipitation_probability INTEGER,
    weather_code INTEGER,
    weather_description VARCHAR(100),
    wind_speed_kmh DECIMAL(6,2),
    source VARCHAR(50) DEFAULT 'open-meteo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (restaurant_id, hour)
);

-- 4. Seed 2026 Kerala Public Holidays
INSERT INTO holidays (country_code, state_code, name, holiday_date, holiday_type, is_public_holiday, source)
VALUES
('IN', 'KL', 'Mannam Jayanthi', '2026-01-02', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Republic Day', '2026-01-26', 'NATIONAL', TRUE, 'Kerala Government'),
('IN', 'KL', 'Id-ul-Fitr (Ramzan)', '2026-03-20', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Maundy Thursday', '2026-04-02', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Good Friday', '2026-04-03', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Dr. B. R. Ambedkar Jayanthi', '2026-04-14', 'NATIONAL', TRUE, 'Kerala Government'),
('IN', 'KL', 'Vishu', '2026-04-15', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'May Day', '2026-05-01', 'NATIONAL', TRUE, 'Kerala Government'),
('IN', 'KL', 'Id-ul-Adha (Bakrid)', '2026-05-27', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Muharram', '2026-06-25', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Karkadaka Vavu', '2026-08-12', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Independence Day', '2026-08-15', 'NATIONAL', TRUE, 'Kerala Government'),
('IN', 'KL', 'First Onam / Milad-i-Sherif', '2026-08-25', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Thiruvonam', '2026-08-26', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Third Onam', '2026-08-27', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Fourth Onam / Sree Narayana Guru Jayanthi / Ayyankali Jayanthi', '2026-08-28', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Sreekrishna Jayanthi', '2026-09-04', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Sree Narayana Guru Samadhi', '2026-09-21', 'STATE_PUBLIC', TRUE, 'Kerala Government'),
('IN', 'KL', 'Gandhi Jayanthi', '2026-10-02', 'NATIONAL', TRUE, 'Kerala Government'),
('IN', 'KL', 'Mahanavami', '2026-10-20', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Vijayadasami', '2026-10-21', 'RELIGIOUS', TRUE, 'Kerala Government'),
('IN', 'KL', 'Christmas', '2026-12-25', 'RELIGIOUS', TRUE, 'Kerala Government')
ON CONFLICT (country_code, state_code, name, holiday_date) DO NOTHING;
