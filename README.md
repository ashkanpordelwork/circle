# مربی من

اپ وب فارسی برای مربی‌های بدنسازی:

- **مربی:** ثبت شاگرد با جیمیل، چیدن برنامه هفتگی، نوشتن یادداشت، دیدن تمرین‌ها و وزن ثبت‌شده
- **شاگرد:** ورود با گوگل، دیدن برنامه امروز و هفته، ثبت ست‌ها با تایمر استراحت، ثبت وزن
- **کتابخانه حرکات:** ۸۷۶ حرکت با عکس از [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (مالکیت عمومی؛ استفاده تجاری هم آزاد است)

| بخش | ابزار |
|---|---|
| ظاهر اپ | React + Vite |
| دیتابیس، ورود با گوگل، سطح دسترسی | Supabase |
| انتشار | GitHub Pages (یا Vercel) |

---

## راه‌اندازی (حدود ۲۰ دقیقه، همه رایگان)

### ۱. Supabase: ساخت پروژه و دیتابیس

1. در `supabase.com` ثبت‌نام کنید ← `New project`.
   - Region: نزدیک‌ترین به کاربران (مثلاً Frankfurt).
2. بروید به `SQL Editor` ← `New query`.
3. کل محتوای فایل `supabase/migrations/0001_init.sql` را کپی و اجرا کنید (`Run`).
4. جیمیل خودتان را به‌عنوان مربی ثبت کنید:

```sql
insert into public.coach_emails (email) values ('your.name@gmail.com');
```

5. از `Project Settings` ← `API` این دو مقدار را بردارید:
   - `Project URL`
   - `anon public` key

### ۲. Google: کلید ورود با گوگل

1. در [Google Cloud Console](https://console.cloud.google.com/) یک پروژه بسازید (از ایران احتمالاً VPN لازم است).
2. `APIs & Services` ← `OAuth consent screen`:
   - نوع `External`، نام اپ و ایمیل خودتان.
   - در پایان `Publish app` را بزنید.
3. `Credentials` ← `Create credentials` ← `OAuth client ID`:
   - نوع: `Web application`
   - در `Authorized redirect URIs` این آدرس را بگذارید (`xxxx` شناسه پروژه Supabase شماست):

```
https://xxxx.supabase.co/auth/v1/callback
```

4. `Client ID` و `Client secret` را کپی کنید.
5. در Supabase: `Authentication` ← `Sign In / Providers` ← `Google` را روشن کنید و این دو مقدار را وارد کنید.

### ۳. انتشار روی GitHub Pages

1. ریپو باید **Public** باشد (Pages رایگان برای ریپوی خصوصی کار نمی‌کند).
   - `Settings` ← پایین صفحه ← `Change visibility`.
2. `Settings` ← `Pages` ← در `Source` گزینه **GitHub Actions** را انتخاب کنید.
3. `Settings` ← `Secrets and variables` ← `Actions` ← تب **Variables** ← `New repository variable`:

```ini
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. تب `Actions` ← `Deploy to GitHub Pages` ← `Run workflow`.
   - بعد از حدود ۲ دقیقه سایت روی این آدرس است: `https://<username>.github.io/<repo>/`
   - از این به بعد هر تغییری در شاخه `main`، سایت را خودکار به‌روز می‌کند.

> اگر Vercel را ترجیح می‌دهید: پروژه را در Vercel اضافه کنید و همان دو مقدار را در `Environment Variables` بگذارید. فایل `vercel.json` آماده است.

### ۴. وصل کردن آدرس سایت به Supabase

- در Supabase: `Authentication` ← `URL Configuration`:
  - `Site URL`: آدرس سایت (مثلاً `https://ashkanpordelwork.github.io/circle/`)
  - `Redirect URLs`: همان آدرس، به‌اضافه `http://localhost:5173/` برای اجرای محلی

### ۵. اولین ورود

1. سایت را باز کنید و «ورود با گوگل» را بزنید.
2. با جیمیلی که در مرحله ۱ ثبت کردید وارد شوید؛ پنل مربی باز می‌شود.
3. شاگرد اضافه کنید. شاگرد با همان جیمیل وارد می‌شود و برنامه‌اش را می‌بیند.

---

## اجرای محلی (برای توسعه)

```bash
npm install
cp .env.example .env.local   # مقادیر Supabase را وارد کنید
npm run dev
```

## تست‌ها

```bash
npm test                 # منطق برنامه و ثبت تمرین
scripts/test-db.sh       # قوانین دسترسی دیتابیس روی یک Postgres موقت (نیاز به Docker)
```

تست دیتابیس بررسی می‌کند که:

- هر مربی فقط شاگردهای خودش را ببیند.
- هر شاگرد فقط برنامه خودش را ببیند و نتواند آن را تغییر دهد.
- کسی که ثبت نشده هیچ داده‌ای نبیند.

## ساختار

```
supabase/migrations/   جدول‌ها، قوانین دسترسی (RLS) و تابع ذخیره برنامه
supabase/tests/        تست قوانین دسترسی
src/lib/               منطق برنامه، کتابخانه حرکات، اتصال Supabase
src/pages/coach/       صفحه‌های مربی
src/pages/student/     صفحه‌های شاگرد
public/exercises.json  کتابخانه حرکات (ساخته‌شده با scripts/build-exercises.mjs)
```

## نکته‌ها

- **ثبت‌نام:** هر کسی با گوگل می‌تواند حساب بسازد، اما تا مربی جیمیلش را ثبت نکند هیچ داده‌ای نمی‌بیند.
- **نام حرکات:** فعلاً انگلیسی است؛ عضلات و تجهیزات فارسی‌اند.
- **دسترسی از ایران:** دامنه‌های `vercel.app` و `supabase.co` ممکن است فیلتر باشند. یک دامنه شخصی روی Vercel کمک می‌کند.
- **پلن رایگان Supabase:** پروژه‌ای که یک هفته استفاده نشود متوقف می‌شود و با یک کلیک در داشبورد دوباره روشن می‌شود.
