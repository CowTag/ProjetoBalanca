# CowTag — Gestão Pecuária com Balança IoT

Balança com ESP32 que identifica o animal por RFID, pesa e envia os dados para um dashboard web.

```
firmware/   ESP32 (PlatformIO + FreeRTOS)
backend/    Node.js + TypeScript + Express + Prisma
frontend/   React + Vite + Tailwind
```

## Como rodar

```bash
docker compose up -d          # PostgreSQL

cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed               # dados demo
npm run dev                   # http://localhost:3000

cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Login demo: `admin@cowtag.local` / `cowtag123`

## Hardware

| Módulo | Pino | ESP32 |
|---|---|---|
| MFRC522 (3.3 V) | SDA / SCK / MOSI / MISO / RST | 5 / 18 / 23 / 19 / 27 |
| HX711 | DT / SCK | 32 / 33 |
| LED de status | — | 2 |
| OLED (opcional) | SDA / SCL | 21 / 22 |

Configuração em `firmware/include/config.h` (Wi-Fi, URL da API, chave do dispositivo).

### Calibração (Monitor Serial, 115200)

- `t` — tara
- `c <gramas>` — calibra com peso conhecido (ex.: `c 500`)
- `i` — mostra peso e fator

### Acompanhamento

- **Dashboard** — painel "Balança ao vivo"
- **Página local** — `http://cowtag-balanca.local`
- **Monitor Serial** — `pio device monitor`
- **LED** — 1 piscada: tag lida · aceso: estabilizando · 2: registrado · 1 longa: erro · 3: offline

> **Modo maquete:** `WEIGHT_SCALE_MULTIPLIER 1000.0` (1 g = 1 kg). Use `1.0` para o peso real.

## API (`/api/v1`)

| Rota | Uso |
|---|---|
| `POST /auth/login` | login |
| `POST /weighings` | pesagem do ESP32 (`X-Device-Key`) |
| `POST /telemetry` | telemetria do ESP32 |
| `POST /live` · `GET /live` | balança ao vivo |
| `/animals` | animais e pesagens |
| `/devices` | balanças |
| `/metrics/overview` | KPIs do dashboard |
| `/farm` · `/users` | fazenda e usuários |

**GMD** (ganho médio diário) = (último peso − primeiro peso) / dias.
