# CowTag — Gestão Pecuária com Balança IoT (ESP32 + Fullstack)

```
┌────────────── ESP32 ──────────────┐        HTTP POST /api/v1/weighings        ┌──────────── Backend (Node/TS) ────────────┐
│ MFRC522 ─┐                        │  ───────────────────────────────────────▶ │ Express + Zod + Prisma ──▶ PostgreSQL     │
│ HX711  ──┼─ FreeRTOS (3 tasks) ───┤        POST /api/v1/telemetry             │                                            │
│ LED    ──┤  buffer offline + NTP  │  ◀── 201 {brinco, ganho_kg} / 404 / 409   │ Socket.io ──▶ eventos em tempo real       │
│ Web local┘ (status no celular)    │                                           └───────────────────┬───────────────────────┘
└───────────────────────────────────┘                                                               │ REST + WebSocket
                                                                           ┌────────────────────────▼──────────────────────┐
                                                                           │ Dashboard React + Vite + Tailwind + Recharts  │
                                                                           └───────────────────────────────────────────────┘
```

```
cowtag/
├── firmware/           PlatformIO (ESP32, Arduino + FreeRTOS)
├── backend/            Node.js + TypeScript + Express + Prisma + Socket.io
├── frontend/           React + Vite + Tailwind + Recharts
└── docker-compose.yml  PostgreSQL 16 (desenvolvimento local)
```

---

## 1. Subindo o ambiente (≈5 min)

```bash
# Banco de dados
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
| **LED de status** | — | GPIO 2 (LED azul já presente no DevKit) |
| **OLED SSD1306 I2C** *(opcional, `USE_OLED 1`)* | SDA / SCL | GPIO 21 / 22 |
| **Célula 5 kg (barra) → HX711** | Vermelho E+, Preto E−, Branco A−, Verde A+ | — |


### Montagem física (protótipo)

- O ESP32 DevKit é largo demais para uma protoboard só. Montagem usada: **protoboard de 60 linhas à esquerda + protoboard de 30 à direita**, ESP32 atravessando a emenda.
  - Placa de 60 (lado 3V3/32/33/27/GND): HX711 e célula de carga.
  - Placa de 30 (lado 23/22/21/19/18/5): OLED, se for usado.
  - MFRC522 fora das placas, via jumpers macho-fêmea; RST (GPIO 27) com jumper longo passando sob o ESP32.
  - **Pontes obrigatórias**: jumper ligando o trilho + das duas placas e outro ligando os trilhos − (o 3V3 do ESP32 fica do lado da placa de 60).

### Calibração da célula de carga (uma vez)

No monitor Serial (115200):

1. Balança vazia → `t` (tara)
2. Coloque um peso conhecido → `c <gramas>`. Com a célula de 5 kg, prefira um peso maior (ex. 500 g ou 1000 g → `c 500`) para um fator mais preciso. A calibração também pode ser feita pela página local do ESP32.
3. `i` mostra peso atual e o fator salvo na flash.

### Lógica da pesagem

1. **taskScale** lê o HX711 a ~10 Hz e mantém uma **média móvel** de 10 amostras. A leitura é *estável* quando `max − min` da janela ≤ 4 g e o peso ≥ 20 g. (Com célula de 5 kg o ruído é maior; se a leitura nunca estabilizar, aumentar `STABLE_TOLERANCE_KG` para ~0.010.)
2. **taskFlow** detecta a tag → espera estabilizar (até 10 s) → captura → entrega para envio.
3. **taskNet** faz o POST. Resultados (estado ao vivo):
   - `201` **REGISTRADO** + brinco + ganho desde a última pesagem
   - `404` **TAG_NAO_CADASTRADA** → cadastre o UID no dashboard
   - `409` **ANIMAL_INATIVO** (vendido/óbito)
   - sem rede / 5xx → **SALVO_OFFLINE**: buffer de 32 pesagens, reenviado com backoff exponencial. O backend é idempotente.
4. A mesma tag é ignorada por 15 s.
5. Telemetria a cada 30 s: `rssi_wifi`, `temperatura_chip`, `heap_livre_kb`, `uptime_s`, `fila_pendente`, `bateria_v`.

### Acompanhando a balança (sem buzzer e sem display)

| Onde | Como abrir | O que mostra |
|---|---|---|
| **Dashboard → "Balança ao vivo"** | Painel e página Balanças | peso atual, estável/oscilando, etapa, tag, resultado, fila offline, eventos recentes |
| **Página local do ESP32** | `http://cowtag-balanca.local` ou `http://<IP>` (mesma rede) | o mesmo, + botões de **Tara** e **Calibrar**. Funciona mesmo sem backend |
| **Monitor Serial** | `pio device monitor` | `[ESTADO]`, `[PESO]`, `[NET]` linha a linha |
| **LED azul (GPIO 2)** | na placa | 1 piscada = tag lida · aceso = estabilizando · 2 = registrado · 1 longa = erro · 3 = offline · pisca lento = sem Wi-Fi |

O ESP32 envia o estado ao vivo para `POST /api/v1/live` quando algo muda (no máximo a cada 2 s, e a cada 10 s sem mudança). O último estado é gravado em `devices.live` (sobrescrito a cada envio) e chega ao dashboard pelo evento Socket.io `scale:live` (local) ou por polling de `GET /live` a cada 2 s (Vercel). O IP do ESP32 aparece no Serial ao conectar no Wi-Fi e no card da balança no dashboard.

Para usar um OLED no futuro: `#define USE_OLED 1` no `config.h`.

> **Modo maquete:** `WEIGHT_SCALE_MULTIPLIER 1000.0` faz 450 g virar 450 kg — útil para demonstrar gráficos de GMD realistas junto com o seed. Com a célula de 5 kg, objetos de 200 g a 600 g dão "bois" de 200 a 600 kg. Para testar a precisão real, use `1.0`.

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
| POST | `/live` | X-Device-Key | estado ao vivo da balança (não grava no banco) |
| GET | `/live` | JWT | último estado de cada balança |
| GET/POST | `/animals` | JWT | lista (com último peso e GMD) / cria |
| GET/PATCH/DELETE | `/animals/:id` | JWT (DELETE admin) | detalhe com histórico e resumo / edita (inclui `status`, `status_data`, `status_obs`) / remove com o histórico |
| POST | `/animals/:id/weighings` | JWT | pesagem manual |
| GET/POST | `/devices` | JWT (POST admin) | lista com telemetria / cria (retorna `api_key` uma vez) |
| POST | `/devices/:id/rotate-key` | admin | nova chave |
| GET | `/devices/:id/telemetry?tipo=&horas=` | JWT | série temporal |
| GET | `/metrics/overview?dias=` | JWT | KPIs, série diária, ranking GMD |
| GET/PUT | `/farm` | JWT (PUT admin) | dados da fazenda |
| GET/POST/DELETE | `/users` | JWT (POST/DELETE admin) | perfis |

**Eventos Socket.io** (sala da fazenda): `weighing:new`, `device:status`, `telemetry:new`, `scale:live`.
Dispositivos sem contato há 90 s são marcados offline automaticamente.

### Segurança

- Chave do dispositivo guardada só como hash SHA-256; comparação em tempo constante.
- Usuários com bcrypt + JWT (12 h); dados sempre filtrados por `fazenda_id` (multi-fazenda).
- Produção: HTTPS (troque `HTTPClient` por `WiFiClientSecure` com o certificado raiz), `JWT_SECRET` forte.

---

## 4. Modelo de dados

Tabelas e campos conforme a especificação (`farms`, `users`, `animals`, `devices`, `weight_logs`, `sensor_logs`). Acréscimos necessários:

- `users.senha_hash` — login
- `devices.api_key_hash`, `devices.ultimo_contato` — autenticação do ESP32 e detecção de offline
- `weight_logs.dispositivo_id` opcional — permite pesagem manual
- `animals.status_data`, `animals.status_obs` — data e observação da venda/óbito
- `devices.live`, `devices.live_em` — último estado "ao vivo" da balança (funciona na Vercel)
- Índices em `(animal_id, timestamp)` e `(dispositivo_id, tipo_sensor, timestamp)`

**GMD** (ganho médio diário) = (último peso − primeiro peso) / dias entre eles (mín. 1 dia).

---