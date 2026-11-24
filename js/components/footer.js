/**
 * SPORTLINK — Minimal Structured Footer
 */

export function renderFooter() {
  const container = document.getElementById('site-footer');
  if (!container) return;

  container.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="brand-wordmark" style="margin-bottom:0.5rem;" dir="ltr"><span>SPORT</span><span style="color:var(--accent-gold);">LINK</span></div>
            <p class="en-wordmark" style="font-size:0.8125rem;letter-spacing:0.12em;color:var(--accent-gold);margin-bottom:0.75rem;">CONNECT. MOVE. GROW.</p>
            <p style="font-size:0.875rem;color:var(--text-muted);max-width:34ch;">
              مرجع معرفی، جست‌وجو و مقایسه باشگاه‌ها و مجموعه‌های ورزشی شهر مشهد. داده‌های نمایش‌داده‌شده در این نسخه آزمایشی هستند.
            </p>
          </div>

          <div>
            <h3 class="footer-heading">کشف مجموعه‌ها</h3>
            <ul class="footer-links">
              <li><a href="/pages/clubs.html">دایرکتوری باشگاه‌های مشهد</a></li>
              <li><a href="/pages/sports.html">رشته‌های ورزشی (۳۵ رشته)</a></li>
              <li><a href="/pages/compare.html">مقایسه باشگاه‌ها</a></li>
              <li><a href="/pages/favorites.html">علاقه‌مندی‌های من</a></li>
            </ul>
          </div>

          <div>
            <h3 class="footer-heading">صاحبان باشگاه و پشتیبانی</h3>
            <ul class="footer-links">
              <li><a href="/pages/management-request.html">درخواست مدیریت مجموعه</a></li>
              <li><a href="/pages/report.html">گزارش مشکل اطلاعات</a></li>
              <li><a href="/pages/contact.html">تماس با SPORTLINK</a></li>
              <li><a href="/pages/terms.html">قوانین و حفظ حریم خصوصی</a></li>
            </ul>
          </div>

          <div>
            <h3 class="footer-heading">ارتباط رسمی</h3>
            <ul class="footer-links">
              <li>منطقه فعالیت فعلی: مشهد، ایران</li>
              <li>ایمیل: <span class="en-wordmark">info-placeholder@sportlink.ir</span></li>
              <li>تلفن: ۰۵۱-۰۰۰۰۰۰۰۰ (پلیسهولدر)</li>
              <li>شبکه‌های اجتماعی: <span class="en-wordmark">@sportlink.ir</span></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <span>© ۱۴۰۵ SPORTLINK — تمامی حقوق محفوظ است.</span>
          <span>نسخه نمایشی فرانت‌اند MVP · منطقه زمانی Asia/Tehran</span>
        </div>
      </div>
    </footer>
  `;
}
