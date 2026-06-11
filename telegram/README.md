# Bora OS — Telegram entegrasyonu

Kod Supabase'de çalışır (edge function `boraos-telegram`, proje `eeelyejmyrjjiusequoh`).
Bu klasördeki `index.ts` o fonksiyonun yedeğidir — değişiklik yapmak için
Claude'a "Telegram fonksiyonunu güncelle" demek yeterli.

- Mesaj saatleri (pg_cron): 06:30 / 12:30 / 21:30 TSİ
  (job adları: boraos-morning / boraos-midday / boraos-evening)
- Webhook: bota yazılanlar app'e düşer (görev / fikir / not / izle)
- Bot: portfolio-platform ile ortak (@bora_portfolio_alerts_bot)
- Token, chat id ve secret fonksiyon kodunun içindedir; bu yedekte
  GIZLI-DEGER ile maskelenmiştir.
