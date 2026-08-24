import { pool } from '@/lib/db';

export interface WeatherQueryOptions {
  restaurantId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  includeHourly?: boolean;
}

export function mapWmoWeatherCode(code: number): string {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55].includes(code)) return 'Drizzle';
  if ([61, 63, 65].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if (code === 95) return 'Thunderstorm';
  if ([96, 99].includes(code)) return 'Thunderstorm with hail';
  return 'Overcast';
}

export async function getWeather(options: WeatherQueryOptions) {
  const { restaurantId, startDate, endDate, includeHourly = false } = options;

  try {
    // 1. Fetch authenticated restaurant location details
    const restRes = await pool.query(
      `SELECT city, state, country, latitude, longitude, timezone 
       FROM restaurants WHERE id = $1 LIMIT 1`,
      [restaurantId]
    );

    if (restRes.rows.length === 0) {
      return { available: false, reason: 'Restaurant not found' };
    }

    const rest = restRes.rows[0];
    const latitude = Number(rest.latitude) || 11.7750435;
    const longitude = Number(rest.longitude) || 75.496864;
    const timezone = rest.timezone || 'Asia/Kolkata';
    const city = rest.city || 'Thalassery';
    const state = rest.state || 'Kerala';

    // 2. Check DB cache first
    const cacheRes = await pool.query(
      `SELECT weather_date, hour, temperature_celsius, precipitation_mm, rain_mm,
              precipitation_probability, weather_code, weather_description, wind_speed_kmh
       FROM weather_hourly
       WHERE restaurant_id = $1 AND weather_date BETWEEN $2 AND $3
       ORDER BY hour ASC`,
      [restaurantId, startDate, endDate]
    );

    let hourlyRecords = cacheRes.rows;

    // 3. If cache is empty or incomplete, fetch from Open-Meteo API
    if (hourlyRecords.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const isPast = endDate < todayStr;
      
      const baseUrl = isPast
        ? 'https://archive-api.open-meteo.com/v1/archive'
        : 'https://api.open-meteo.com/v1/forecast';

      const url = `${baseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,precipitation,rain,precipitation_probability,weather_code,wind_speed_10m&timezone=${encodeURIComponent(timezone)}`;

      const response = await fetch(url);
      if (!response.ok) {
        return { available: false, reason: 'Weather provider API error' };
      }

      const weatherData = await response.json();
      const hourly = weatherData.hourly;

      if (!hourly || !hourly.time || hourly.time.length === 0) {
        return { available: false, reason: 'No weather records returned' };
      }

      // Process and save records into cache
      const newRecords = [];
      for (let i = 0; i < hourly.time.length; i++) {
        const timeISO = hourly.time[i]; // e.g. "2026-08-24T00:00"
        const weatherDate = timeISO.split('T')[0];
        const temp = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
        const precip = hourly.precipitation ? hourly.precipitation[i] : 0;
        const rain = hourly.rain ? hourly.rain[i] : 0;
        const prob = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
        const code = hourly.weather_code ? hourly.weather_code[i] : 0;
        const wind = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : 0;
        const desc = mapWmoWeatherCode(code);

        // Save to DB
        await pool.query(
          `INSERT INTO weather_hourly 
             (restaurant_id, weather_date, hour, temperature_celsius, precipitation_mm, rain_mm, precipitation_probability, weather_code, weather_description, wind_speed_kmh)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (restaurant_id, hour) DO UPDATE 
           SET temperature_celsius = EXCLUDED.temperature_celsius,
               precipitation_mm = EXCLUDED.precipitation_mm,
               rain_mm = EXCLUDED.rain_mm,
               weather_description = EXCLUDED.weather_description`,
          [restaurantId, weatherDate, timeISO, temp, precip, rain, prob, code, desc, wind]
        );

        newRecords.push({
          weather_date: weatherDate,
          hour: timeISO,
          temperature_celsius: temp,
          precipitation_mm: precip,
          rain_mm: rain,
          precipitation_probability: prob,
          weather_code: code,
          weather_description: desc,
          wind_speed_kmh: wind
        });
      }
      hourlyRecords = newRecords;
    }

    if (hourlyRecords.length === 0) {
      return { available: false, reason: 'Weather data unavailable' };
    }

    // 4. Normalize & Aggregate Data
    let totalTemp = 0;
    let minTemp = 999;
    let maxTemp = -999;
    let totalRain = 0;
    let rainHours = 0;
    let maxProb = 0;
    let maxWind = 0;

    const conditionCounts: Record<string, number> = {};
    const rainByHourMap: { hourStr: string; rain: number }[] = [];

    hourlyRecords.forEach((r) => {
      const temp = Number(r.temperature_celsius) || 0;
      const rain = Number(r.rain_mm || r.precipitation_mm) || 0;
      const prob = Number(r.precipitation_probability) || 0;
      const wind = Number(r.wind_speed_kmh) || 0;
      const desc = r.weather_description || 'Clear';

      totalTemp += temp;
      if (temp < minTemp) minTemp = temp;
      if (temp > maxTemp) maxTemp = temp;

      totalRain += rain;
      if (rain > 0.1) rainHours++;
      if (prob > maxProb) maxProb = prob;
      if (wind > maxWind) maxWind = wind;

      conditionCounts[desc] = (conditionCounts[desc] || 0) + 1;

      const hourStr = typeof r.hour === 'string' ? r.hour.split('T')[1]?.slice(0, 5) || '00:00' : '00:00';
      rainByHourMap.push({ hourStr, rain });
    });

    const count = hourlyRecords.length;
    const avgTemp = Number((totalTemp / count).toFixed(1));
    minTemp = minTemp === 999 ? avgTemp : Number(minTemp.toFixed(1));
    maxTemp = maxTemp === -999 ? avgTemp : Number(maxTemp.toFixed(1));

    // Find dominant condition
    let dominantCondition = 'Clear';
    let maxCount = 0;
    Object.entries(conditionCounts).forEach(([cond, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        dominantCondition = cond;
      }
    });

    // Detect Peak Rain Period (e.g., "18:00-21:00")
    let peakRainPeriod = 'None';
    let maxRainBlock = 0;
    for (let i = 0; i < rainByHourMap.length - 2; i++) {
      const blockRain = rainByHourMap[i].rain + rainByHourMap[i + 1].rain + rainByHourMap[i + 2].rain;
      if (blockRain > maxRainBlock && blockRain > 1.0) {
        maxRainBlock = blockRain;
        peakRainPeriod = `${rainByHourMap[i].hourStr}-${rainByHourMap[i + 2].hourStr}`;
      }
    }

    // Prepare response
    const result: any = {
      available: true,
      location: {
        city,
        state,
        timezone
      },
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        averageTemperatureC: avgTemp,
        minTemperatureC: minTemp,
        maxTemperatureC: maxTemp,
        rainfallMm: Number(totalRain.toFixed(1)),
        rainHours,
        maxRainProbability: maxProb,
        maxWindSpeedKmh: Number(maxWind.toFixed(1)),
        dominantCondition,
        peakRainPeriod
      }
    };

    if (includeHourly) {
      result.hourly = hourlyRecords.map((r) => ({
        hour: typeof r.hour === 'string' ? r.hour.split('T')[1]?.slice(0, 5) || r.hour : r.hour,
        temperatureC: Number(r.temperature_celsius),
        rainfallMm: Number(r.rain_mm || r.precipitation_mm || 0),
        rainProbability: Number(r.precipitation_probability || 0),
        condition: r.weather_description || 'Clear'
      }));
    }

    return result;
  } catch (error: any) {
    console.error('Weather Service Error:', error);
    return { available: false, reason: 'Failed to retrieve weather data' };
  }
}
