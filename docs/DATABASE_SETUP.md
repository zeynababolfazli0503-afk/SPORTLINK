# راهنمای راه‌اندازی و نگهداری دیتابیس PostgreSQL — SPORTLINK

این مستند نحوه راه‌اندازی، اجرای Migrationها، Rollback، Seed داده‌های پایه و اجرای تست‌های لایه دیتابیس پروژه **SPORTLINK** (نسخه مشهد، زبان فارسی، منطقه زمانی `Asia/Tehran`، واحد پول تومان) را توضیح می‌دهد.

## ۱. پیش‌نیازها

- **PostgreSQL 15+** با رمزنگاری **UTF-8** و منطقه زمانی `Asia/Tehran`
- **Node.js 20+** و نصب وابستگی‌ها (`npm install`)
- درایور **`pg`** (بدون ORM؛ تمامی کوئری‌ها به‌صورت SQL پارامتری‌شده `$1, $2, ...` اجرا می‌شوند)

## ۲. تنظیم متغیرهای محیطی

فایل `.env` را از روی `.env.example` بسازید (هرگز فایل `.env` را در مخزن commit نکنید):

```bash
cp .env.example .env
```

مقادیر اتصال PostgreSQL را در `.env` تکمیل کنید:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=sportlink
PGUSER=sportlink_app
PGPASSWORD=<your-secure-password>
PGSSL=false
PGPOOL_MAX=10
APP_TIMEZONE=Asia/Tehran
```

## ۳. ساخت دیتابیس در PostgreSQL

```sql
CREATE DATABASE sportlink
  WITH ENCODING 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE template0;

ALTER DATABASE sportlink SET timezone TO 'Asia/Tehran';
```

## ۴. ساختار جدول‌ها و Migrationها

اسکریپت‌های Migration در پوشه `db/migrations/` به‌صورت جفت‌های `up` / `down` نسخه‌بندی شده‌اند و دقیقاً **۳۰ جدول دامنه مصوب** را می‌سازند:

1. `001_extensions_enums_functions`: اکستنشن‌های `pgcrypto` و `pg_trgm`، تابع تریگر `set_updated_at()` و ۱۲ نوع `ENUM`
2. `002_core_geography_files_auth`: `cities`, `neighborhoods`, `club_types`, `stored_files`, `users`, `sub_admin_permissions`, `user_sessions`, `otp_verifications`
3. `003_sports_clubs_analytics`: `sports_categories`, `sports`, `facilities`, `clubs`, `club_sports`, `club_facilities`, `club_images`, `club_operating_hours`, `club_daily_metrics`
4. `004_personalization_workflows_governance`: `user_favorite_clubs`, `user_favorite_sports`, `user_comparisons`, `user_search_history`, `club_management_requests`, `club_change_requests`, `club_edit_history`, `club_reports`, `contact_messages`, `notifications`, `notification_user_states`, `admin_activity_logs`, `platform_settings`

> **توضیح جدول فنی `schema_migrations`:** علاوه‌بر ۳۰ جدول دامنه، Migration Runner یک جدول فنی کوچک با نام `schema_migrations` برای ثبت نسخه، نام فایل و Checksum هر Migration اعمال‌شده ایجاد می‌کند تا اجرای مجدد یا Rollback ایمن و idempotent باشد.

## ۵. دستورات اجرا

```bash
# بررسی وضعیت Migrationها
npm run db:status

# اجرای تمامی Migrationها به ترتیب نسخه
npm run db:migrate

# بازگشت آخرین Migration (یا مشخص کردن تعداد مراحل با آرگومان)
npm run db:rollback
npx tsx db/cli.ts migrate:down 4

# بارگذاری داده‌های پایه کاتالوگ (مشهد، ۸ محله، ۶ نوع باشگاه، ۷ دسته، ۳۵ رشته، ۱۰ امکانات، تنظیمات پایه)
npm run db:seed

# بارگذاری داده‌های نمونه و توسعه (شامل کاتالوگ + ۱۶ باشگاه، ۴ کاربر نمونه، درخواست‌ها، گزارش‌ها و اعلان‌ها)
npm run db:seed:dev
```

## ۶. تست و راستی‌آزمایی

```bash
# اجرای تست‌های آفلاین ساختار SQL و یکپارچگی Seed + تست‌های یکپارچگی PostgreSQL زنده (در صورت تنظیم متغیرهای PG)
npm run test:db
```
