#pragma once
// =====================================================================
//  CowTag - Configuração do firmware (edite antes de gravar)
// =====================================================================

// ---------- Wi-Fi ----------
#define WIFI_SSID        "SUA_REDE_WIFI"
#define WIFI_PASS        "SUA_SENHA_WIFI"

// ---------- API ----------
// IP da máquina que roda o backend (não use "localhost": o ESP32 é outro host)
#define API_BASE_URL     "http://192.168.0.10:3000"
#define DEVICE_ID        "BALANCA_ESP32_01"     // = devices.identificador_esp32
#define DEVICE_KEY       "dev-key-balanca-01"   // chave gerada no dashboard (seed usa esta)

// ---------- Pinagem ----------
// MFRC522 (SPI VSPI): SCK=18, MISO=19, MOSI=23
#define PIN_RFID_SS      5
#define PIN_RFID_RST     27
// HX711
#define PIN_HX_DOUT      32
#define PIN_HX_SCK       33
// OLED SSD1306 I2C 128x64
#define PIN_OLED_SDA     21
#define PIN_OLED_SCL     22
#define OLED_ADDR        0x3C
// Buzzer (ativo ou passivo; usa tone())
#define PIN_BUZZER       25
// Bateria via divisor resistivo 1:1 em pino ADC1 (ex.: 34). -1 = desabilitado
#define PIN_BATTERY      -1
#define BATTERY_DIVIDER  2.0f

// ---------- Balança ----------
// Fator de calibração em "contagens por kg". Rode "c 200" no Serial com 200 g
// sobre a célula para calibrar; o valor fica salvo na flash (Preferences).
#define DEFAULT_CAL_FACTOR    420000.0f
#define MA_WINDOW             10        // janela da média móvel (amostras, ~10 Hz)
#define STABLE_TOLERANCE_KG   0.004f    // variação máx (max-min) na janela p/ considerar estável
#define MIN_WEIGHT_KG         0.020f    // abaixo disso = balança vazia
// Multiplicador aplicado só no envio/exibição.
// 1.0 = peso real da célula de 1 kg. 1000.0 = "modo maquete" (1 g = 1 kg de boi).
#define WEIGHT_SCALE_MULTIPLIER 1.0f

// ---------- Tempos ----------
#define TAG_WAIT_STABLE_MS    10000     // tempo máx p/ estabilizar após ler a tag
#define SAME_TAG_DEBOUNCE_MS  15000     // ignora a mesma tag nesse intervalo
#define RESULT_SHOW_MS        2500
#define HEARTBEAT_MS          30000     // telemetria
#define HTTP_TIMEOUT_MS       5000
#define PENDING_MAX           32        // buffer offline de pesagens (RAM)
