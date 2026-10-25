# 🚀 Qdine AI Business Analyst Database Migrations & Deployment Guide

This document lists all database migrations required for deploying the **Qdine AI Business Analyst** module, Gemini quota management, and weather & holiday forecasting.

---

## 📂 Required Migration SQL Files (In Execution Order)

| # | Migration File | Description | Key Tables & Changes |
|---|---|---|---|
| 1 | `migration_gemini_quota.sql` | Gemini global quota tracking & rate-limiting | Creates `gemini_config`, `gemini_daily_usage`, `gemini_usage`, `gemini_request_config`, `gemini_usage_monthly` |
| 2 | `migration_ai_analyst.sql` | Chat session & message storage | Creates `ai_chat_sessions`, `ai_chat_messages`, registers `BUSINESS_ANALYST_CHAT` (10,000 max tokens) |
| 3 | `migration_weather_holidays.sql` | Weather forecasting & public holiday support | Creates `holidays`, `weather_hourly`, adds geolocation & address columns to `restaurants`, seeds 2026 Kerala public holidays |

---

## ⚡ Automated Execution (One Command)

When merging to staging or production, run the unified automated runner script:

```bash
node run_all_ai_migrations.js
```

### What `run_all_ai_migrations.js` Does:
1. Reads `DATABASE_URL` from `.env.local` or `.env`.
2. Connects to PostgreSQL.
3. Automatically executes all 3 migration files inside explicit transactions (`BEGIN` ... `COMMIT`).
4. Prints step-by-step confirmation.

---

## 🛡️ Built-in Auto Migrations

In addition to manual/CI deployment scripts, `src/lib/db.ts` contains `runAutoMigration()` which automatically executes `CREATE TABLE IF NOT EXISTS` for all these tables on backend startup, ensuring zero missing table errors in production!
