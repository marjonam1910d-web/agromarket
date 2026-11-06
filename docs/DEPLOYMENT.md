# Production deployment (Ubuntu 22.04/24.04 VPS)

Minimal resurs: 2 vCPU, 4 GB RAM, 40 GB SSD (100+ bir vaqtdagi foydalanuvchi uchun yetarli — yuklama testi natijasi: docs/TESTING.md).

## 1. Server tayyorlash
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx ufw
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
sudo usermod -aG docker $USER   # qayta kiring
```

## 2. Kod va sozlamalar
```bash
sudo mkdir -p /opt/agromarket && sudo chown $USER /opt/agromarket
git clone <repo-url> /opt/agromarket && cd /opt/agromarket
cp .env.example .env
# Majburiy: POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OTP_SECRET, APP_URL, API_PUBLIC_URL
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # har bir kalit uchun
```

## 3. Ishga tushirish
```bash
docker compose up -d --build
docker compose ps                         # hammasi healthy bo'lishi kerak
docker compose logs -f backend            # migratsiyalar avtomatik qo'llanadi
docker compose exec backend npm run create-admin -- --email admin@agromarket.uz --name "Bosh admin"
```
Kategoriyalarni admin paneldan yarating (yoki faqat birinchi marta: `docker compose exec -e SEED_ALLOW_PRODUCTION=true -e SEED_ADMIN_PASSWORD=... backend npx tsx prisma/seed.ts` — demo mahsulotlar ham yaratiladi, productionda tavsiya etilmaydi).

## 4. HTTPS (Nginx + Let's Encrypt)
```bash
sudo cp docker/nginx/host-site.conf /etc/nginx/sites-available/agromarket
sudo sed -i 's/agromarket.uz/SIZNING-DOMEN/g' /etc/nginx/sites-available/agromarket
sudo ln -s /etc/nginx/sites-available/agromarket /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo certbot --nginx -d SIZNING-DOMEN -d www.SIZNING-DOMEN
sudo nginx -t && sudo systemctl reload nginx
```
`.env` da `COOKIE_SECURE=true`, `APP_URL=https://SIZNING-DOMEN`, `API_PUBLIC_URL=https://SIZNING-DOMEN` bo'lsin.

## 5. Payme/Click webhooklari
Kabinetlarda: `https://SIZNING-DOMEN/api/v1/payments/payme`, `.../payments/click/prepare`, `.../payments/click/complete`.
Batafsil: docs/INTEGRATIONS.md.

## 6. Zaxira va tiklash
```bash
./scripts/backup.sh                              # backups/db-*.dump + uploads-*.tar.gz
crontab -e  →  0 3 * * * /opt/agromarket/scripts/backup.sh >> /var/log/agromarket-backup.log 2>&1
./scripts/restore.sh backups/db-20261106-030000.dump backups/uploads-20261106-030000.tar.gz
```
Zaxiralarni boshqa serverga ham nusxalang (masalan `rclone` bilan S3'ga).

## 7. Yangilash
```bash
git pull && docker compose up -d --build backend web
```

## 8. Monitoring
* `GET /api/v1/health` — DB, Redis, to'lov va SMS integratsiyalari holati (UptimeRobot va h.k.ga ulang).
* Loglar: `docker compose logs --since 1h backend` (productionda JSON format).
* Bir nechta API instansiyasi: `docker compose up -d --scale backend=3` (Redis bilan WebSocket va rate-limit taqsimlanadi; fon vazifalari advisory lock bilan faqat bitta instansiyada ishlaydi).
