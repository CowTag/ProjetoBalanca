#pragma once
// =====================================================================
//  CowTag - Configuração do firmware (edite antes de gravar)
// =====================================================================

// ---------- Wi-Fi ----------
#define WIFI_SSID        "Familia_BR"
#define WIFI_PASS        "1314152020"

// ---------- API ----------
// Escolha UM dos dois (sem barra no final):
//  - Internet (Vercel):  "https://SEU-PROJETO.vercel.app"  -> funciona de qualquer rede
//  - Rede local:         "http://<IP do PC>:3000"           -> não use "localhost": o ESP32 é outro host
#define API_BASE_URL     "http://192.168.0.111:3000"
#define DEVICE_ID        "BALANCA_ESP32_01"     // = devices.identificador_esp32
#define DEVICE_KEY       "dev-key-balanca-01"   // chave gerada no dashboard (seed usa esta)

// ---------- Onde acompanhar a balança ----------
// 1) Monitor Serial (115200) ............ sempre ativo
// 2) Página local no próprio ESP32 ...... http://cowtag-balanca.local ou http://<IP do ESP32>
// 3) Dashboard web (painel "Balança ao vivo") via POST /api/v1/live
// 4) LED azul da placa (GPIO 2) ......... feedback piscando
// 5) OLED .............................. opcional (USE_OLED 1)
#define USE_OLED           0          // 0 = sem display | 1 = SSD1306 I2C
#define USE_LOCAL_WEB      1          // página de status no ESP32
#define MDNS_NAME          "cowtag-balanca"   // -> http://cowtag-balanca.local
#define LIVE_PUSH_MIN_MS   2000       // intervalo mínimo entre envios "ao vivo" (o painel na Vercel atualiza a cada 2 s)
#define LIVE_KEEPALIVE_MS  10000      // envia mesmo sem mudança a cada X ms

// ---------- Pinagem ----------
// MFRC522 (SPI VSPI): SCK=18, MISO=19, MOSI=23
#define PIN_RFID_SS      5
#define PIN_RFID_RST     27
// HX711
#define PIN_HX_DOUT      32
#define PIN_HX_SCK       33
// OLED SSD1306 I2C 128x64 (só usado se USE_OLED 1)
#define PIN_OLED_SDA     21
#define PIN_OLED_SCL     22
#define OLED_ADDR        0x3C
// LED de status: 2 = LED azul onboard do DevKit. -1 = desabilitado
#define PIN_STATUS_LED       2
#define STATUS_LED_ACTIVE_LOW 0       // 1 se o LED acende com nível baixo
// Bateria via divisor resistivo 1:1 em pino ADC1 (ex.: 34). -1 = desabilitado
#define PIN_BATTERY      -1
#define BATTERY_DIVIDER  2.0f

// ---------- Balança ----------
// Fator de calibração em "contagens por kg". Calibre pelo Serial ("c 200")
// ou pela página local; o valor fica salvo na flash (Preferences).
// Célula de 5 kg: calibre com 500-1000 g para mais precisão ("c 500").
#define DEFAULT_CAL_FACTOR    420000.0f
#define MA_WINDOW             10        // janela da média móvel (amostras, ~10 Hz)
#define STABLE_TOLERANCE_KG   0.004f    // variação máx (max-min) na janela. Célula 5 kg ruidosa? use ~0.010f
#define MIN_WEIGHT_KG         0.020f    // abaixo disso = balança vazia
// Multiplicador aplicado só no envio/exibição.
// 1.0 = peso real da célula (5 kg). 1000.0 = "modo maquete" (1 g = 1 kg de boi).
#define WEIGHT_SCALE_MULTIPLIER 100.0f

// ---------- Tempos ----------
#define TAG_WAIT_STABLE_MS    10000     // tempo máx p/ estabilizar após ler a tag
#define SAME_TAG_DEBOUNCE_MS  15000     // ignora a mesma tag nesse intervalo
#define RESULT_SHOW_MS        2500
#define HEARTBEAT_MS          30000     // telemetria
#define HTTP_TIMEOUT_MS       5000
#define PENDING_MAX           32        // buffer offline de pesagens (RAM)
