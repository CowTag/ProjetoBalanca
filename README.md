# CowTag — Gestão Pecuária com Balança IoT (ESP32 + Fullstack)

```
┌────────────── ESP32 ──────────────┐        HTTP POST /api/v1/weighings        ┌──────────── Backend (Node/TS) ────────────┐
│ MFRC522 ─┐                        │  ───────────────────────────────────────▶ │ Express + Zod + Prisma ──▶ PostgreSQL     │
│ HX711  ──┼─ FreeRTOS (3 tasks) ───┤        POST /api/v1/telemetry             │ Ponte MQTT (opcional, cowtag/+/pesagem)   │
│ OLED   ──┤  buffer offline + NTP  │  ◀── 201 {brinco, ganho_kg} / 404 / 409   │ Socket.io ──▶ eventos em tempo real       │
│ Buzzer ──┘                        │                                           └───────────────────┬───────────────────────┘
└───────────────────────────────────┘                                                               │ REST + WebSocket
                                                                           ┌────────────────────────▼──────────────────────┐
                                                                           │ Dashboard React + Vite + Tailwind + Recharts  │
                                                                           └───────────────────────────────────────────────┘
```

```
cowtag/
├── firmware/           PlatformIO (ESP32, Arduino + FreeRTOS)
├── backend/            Node.js + TypeScript + Express + Prisma + Socket.io + MQTT
├── frontend/           React + Vite + Tailwind + Recharts
├── infra/              mosquitto.conf
└── docker-compose.yml  PostgreSQL 16 + Mosquitto
```

---

## 1. Subindo o ambiente (≈5 min)

Pré-requisitos: Node 20+, Docker, VS Code + extensão PlatformIO.

```bash
# Banco + broker MQTT
docker compose up -d

# Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init     # cria as tabelas
npm run db:seed                        # dados demo
npm run dev                            # http://localhost:3000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

Login demo: **admin@cowtag.local / cowtag123** (ou operador@cowtag.local).

### Testando a API sem hardware

```bash
curl -X POST http://localhost:3000/api/v1/weighings \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: dev-key-balanca-01" \
  -d '{"device_id":"BALANCA_ESP32_01","rfid_tag":"43:A2:89:C1","weight_kg":0.450,"timestamp":"2026-11-09T15:44:00Z"}'
```

Abra o dashboard ao lado — a pesagem aparece em "Pesagens ao vivo" instantaneamente.

Via MQTT (com `mosquitto_pub`):

```bash
mosquitto_pub -t cowtag/BALANCA_ESP32_01/pesagem -m '{"rfid_tag":"43:A2:89:C1","weight_kg":0.452}'
mosquitto_sub -t 'cowtag/+/resposta'
```

---

## 2. Hardware

### Ligações

| Módulo | Pino módulo | ESP32 |
|---|---|---|
| **MFRC522** (3.3 V!) | SDA/SS | GPIO 5 |
| | SCK | GPIO 18 |
| | MOSI | GPIO 23 |
| | MISO | GPIO 19 |
| | RST | GPIO 27 |
| | 3.3V / GND | 3V3 / GND |
| **HX711** | DT (DOUT) | GPIO 32 |
| | SCK | GPIO 33 |
| | VCC / GND | 3V3 / GND |
| **OLED SSD1306 I2C** | SDA / SCL | GPIO 21 / 22 |
| | VCC / GND | 3V3 / GND |
| **Buzzer** | + | GPIO 25 (via transistor se for > 20 mA) |
| **Célula 1 kg → HX711** | Vermelho E+, Preto E−, Branco A−, Verde A+ | — |

> O MFRC522 **não** tolera 5 V. Bateria opcional: divisor 100k/100k em GPIO 34 e `PIN_BATTERY 34`.

### Gravando o firmware

1. Edite `firmware/include/config.h`: `WIFI_SSID`, `WIFI_PASS`, `API_BASE_URL` (IP do seu PC na rede, ex. `http://192.168.0.10:3000`), `DEVICE_ID`, `DEVICE_KEY`.
2. `pio run -t upload && pio device monitor`

### Calibração da célula de carga (uma vez)

No monitor Serial (115200):

1. Balança vazia → `t` (tara)
2. Coloque um peso conhecido (ex. 200 g) → `c 200`
3. `i` mostra peso atual e o fator salvo na flash.

### Lógica da pesagem

1. **taskScale** lê o HX711 a ~10 Hz e mantém uma **média móvel** de 10 amostras. A leitura é *estável* quando `max − min` da janela ≤ 4 g e o peso ≥ 20 g.
2. **taskFlow** detecta a tag → bip curto → espera estabilizar (até 10 s) → captura → bip → OLED “Enviando…”.
3. **taskNet** faz o POST. Respostas exibidas no OLED:
   - `201` **REGISTRADO** + brinco + ganho desde a última pesagem (bip duplo agudo)
   - `404` **TAG NAO CADASTRADA** + UID (bip grave) → cadastre o UID no dashboard
   - `409` **ANIMAL INATIVO** (vendido/óbito)
   - sem rede / 5xx → **SALVO OFFLINE**: fica num buffer de 32 pesagens e é reenviado com backoff exponencial. O backend é idempotente (mesmo animal + dispositivo + timestamp não duplica).
4. A mesma tag é ignorada por 15 s (evita pesar o mesmo animal duas vezes).
5. Telemetria a cada 30 s: `rssi_wifi`, `temperatura_chip`, `heap_livre_kb`, `uptime_s`, `fila_pendente`, `bateria_v`.

> **Modo maquete:** com célula de 1 kg, `WEIGHT_SCALE_MULTIPLIER 1000.0` faz 450 g virar 450 kg — útil para demonstrar gráficos de GMD realistas junto com o seed.

> **Timestamp:** o ESP sincroniza via NTP. Se pesar antes do primeiro sync (sem internet), o campo `timestamp` é omitido e o servidor usa a hora de chegada.

---

## 3. API REST (`/api/v1`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/login` | — | `{email, senha}` → `{token, user}` |
| GET | `/auth/me` | JWT | usuário + fazenda |
| **POST** | **`/weighings`** | **X-Device-Key** | ingestão do ESP32 |
| GET | `/weighings?limit=&animal_id=` | JWT | pesagens recentes |
| POST | `/telemetry` | X-Device-Key | `{device_id, readings:[{tipo_sensor, valor}]}` |
| GET/POST | `/animals` | JWT | lista (com último peso e GMD) / cria |
| GET/PATCH/DELETE | `/animals/:id` | JWT (DELETE admin) | detalhe com histórico e resumo |
| POST | `/animals/:id/weighings` | JWT | pesagem manual |
| GET/POST | `/devices` | JWT (POST admin) | lista com telemetria / cria (retorna `api_key` uma vez) |
| POST | `/devices/:id/rotate-key` | admin | nova chave |
| GET | `/devices/:id/telemetry?tipo=&horas=` | JWT | série temporal |
| GET | `/metrics/overview?dias=` | JWT | KPIs, série diária, ranking GMD |
| GET/PUT | `/farm` | JWT (PUT admin) | dados da fazenda |
| GET/POST/DELETE | `/users` | JWT (POST/DELETE admin) | perfis |

**Eventos Socket.io** (sala da fazenda): `weighing:new`, `device:status`, `telemetry:new`.
Dispositivos sem contato há 90 s são marcados offline automaticamente.

### Segurança

- Chave do dispositivo guardada só como hash SHA-256; comparação em tempo constante.
- Usuários com bcrypt + JWT (12 h); dados sempre filtrados por `fazenda_id` (multi-fazenda).
- Produção: HTTPS (troque `HTTPClient` por `WiFiClientSecure` com o certificado raiz), Mosquitto com usuário/senha/ACL, `JWT_SECRET` forte.

---

## 4. Modelo de dados

Tabelas e campos conforme a especificação (`farms`, `users`, `animals`, `devices`, `weight_logs`, `sensor_logs`). Acréscimos necessários:

- `users.senha_hash` — login
- `devices.api_key_hash`, `devices.ultimo_contato` — autenticação do ESP32 e detecção de offline
- `weight_logs.dispositivo_id` opcional — permite pesagem manual
- Índices em `(animal_id, timestamp)` e `(dispositivo_id, tipo_sensor, timestamp)`

**GMD** (ganho médio diário) = (último peso − primeiro peso) / dias entre eles (mín. 1 dia).

---

## 5. Próximos passos sugeridos

- Supabase: o schema Prisma funciona direto apontando `DATABASE_URL` para o Postgres do Supabase.
- Firmware via MQTT (PubSubClient) usando os tópicos já suportados pelo backend.
- Buffer offline persistente em LittleFS (hoje é em RAM).
- OTA (ArduinoOTA) e provisionamento de Wi-Fi (WiFiManager).
- Exportar relatórios CSV/PDF e alertas de GMD baixo.
