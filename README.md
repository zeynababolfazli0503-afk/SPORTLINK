# SPORTLINK (MVP Front-End — Mashhad)

**CONNECT. MOVE. GROW.**

فرانت‌اند کامل وب‌سایت SPORTLINK با استفاده از **HTML5**، **CSS3** و **Vanilla JavaScript (ES Modules)** و طراحی اختصاصی **Premium Modern Sports-Tech** (کاملاً راست‌چین / RTL، واحد پول تومان، تقویم شمسی، منطقه زمانی Asia/Tehran و محدوده جغرافیایی مشهد).

## ساختار پوشه‌ها
- `index.html`: صفحه اصلی
- `pages/`: تمامی صفحات دایرکتوری باشگاه‌ها، جزئیات باشگاه، رشته‌های ورزشی (۳۵ رشته در ۷ دسته)، جزئیات رشته، ورود، ثبت‌نام، پروفایل، علاقه‌مندی‌ها، مقایسه حداکثر ۲ باشگاه، اعلان‌ها، درخواست مدیریت و ثبت باشگاه، پنل مدیر باشگاه، پنل مدیریت اصلی SPORTLINK، تماس با ما، گزارش مشکل، قوانین، و صفحات خطای 404/403/خطای عمومی.
- `css/`: استایل‌های ماژولار (`variables.css`, `reset.css`, `layout.css`, `components.css`, `forms.css`, `pages.css`, `responsive.css`, `style.css`).
- `js/`: ماژول‌های تفکیک‌شده داده (`data.js`)، لایه ذخیره‌سازی (`storage.js`)، اعتبارسنجی (`validation.js`)، جست‌وجو (`search.js`)، فیلتر و صفحه‌بندی (`filters.js`)، احراز هویت شبیه‌سازی‌شده (`auth.js`)، علاقه‌مندی‌ها، مقایسه، اعلان‌ها، کامپوننت‌های مشترک و کنترلرهای صفحات.
- `tests/`: تست‌های واحد با `node:test`.

## اجرا
```bash
npm install
npm run dev
```
سپس نشانی `http://localhost:3000` را باز کنید.
