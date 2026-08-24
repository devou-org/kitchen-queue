# Qdine AI Business Analyst — Weather & Holidays Integration

## 1. Overview
The Qdine AI Business Analyst now integrates real-time and historical weather data via Open-Meteo along with public & regional holiday data to provide deep context for sales shifts, footfall variations, and business performance analysis.

---

## 2. Database Schema & Migrations

### Migration Files
- `migration_weather_holidays.sql`: SQL migration adding location columns to `restaurants`, creating `holidays` and `weather_hourly` tables, and seeding 2026 Kerala public holidays.
- `run_migration_weather_holidays.js`: Migration runner script.
- `src/lib/db.ts`: Updated `runAutoMigration` and `getRestaurantBySlug` to include location columns automatically in production environments.

### Schema Details

#### `restaurants` Table Extensions
```sql
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
```

#### `holidays` Table
```sql
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
```

#### `weather_hourly` Cache Table
```sql
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
```

---

## 3. Architecture & Weather Service (`src/modules/ai/services/weather.service.ts`)

```
User -> Gemini -> getWeather() -> Weather Service -> DB Cache Check
                                                        ├── Cache Hit  -> Return Data
                                                        └── Cache Miss -> Open-Meteo API -> Normalize -> DB Cache -> Return Data
```

### Features
1. **Dynamic Routing**: Automatically uses Forecast API (`/v1/forecast`) for future/today queries and Historical API (`/v1/archive`) for past historical weather analysis.
2. **WMO Weather Code Normalization**: Translates numeric WMO codes (e.g. `61`, `81`, `95`) into human-readable conditions (`Rain`, `Rain showers`, `Thunderstorm`).
3. **Data Aggregation**: Aggregates hourly weather arrays into token-efficient daily summaries (`averageTemperatureC`, `minTemperatureC`, `maxTemperatureC`, `rainfallMm`, `rainHours`, `dominantCondition`, `peakRainPeriod`).
4. **Token Optimization**: Only returns detailed hourly arrays when `includeHourly: true` is explicitly requested by the AI.

---

## 4. AI Analyst Tooling & Function Calling

### Newly Registered Tools
1. `getWeather`: Fetches weather metrics for the authenticated restaurant location over a specified date range.
2. `getHolidays`: Queries public, national, and state holidays for the restaurant location over a specified date range.

### Location & Causation Safety Rules
- **Configured Location**: All queries use the restaurant's stored location (`latitude`, `longitude`, `timezone`, `country_code`, `state_code`). Coordinate overrides by users or AI are strictly prohibited.
- **Causation Guideline**: Weather and holiday correlations are reported objectively without making unsupported causal claims (e.g. "Sales dropped during heavy rainfall" rather than "Rain caused sales to drop").
