// =====================================================================
//  CowTag - Firmware da balança pecuária (ESP32 + FreeRTOS)
//
//  Tarefas:
//   - taskScale (core 1): lê HX711 ~10 Hz, média móvel + detecção de estabilidade
//   - taskFlow  (core 1): RFID -> espera peso estável -> captura -> feedback OLED/buzzer
//   - taskNet   (core 0): Wi-Fi, NTP, envio HTTP com buffer offline e retry, telemetria
//   - loop()          : comandos Serial (t = tara, c <gramas> = calibrar, i = info)
// =====================================================================
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <HX711.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include "config.h"

// ---------------------------------------------------------------------
// Tipos e estado compartilhado
// ---------------------------------------------------------------------
struct Weighing {
  char     tag[24];
  float    kg;
  char     ts[25];   // ISO-8601 UTC ou "" se relógio não sincronizado
  uint32_t seq;
};

enum class SendResult : uint8_t { OK, DUPLICATE, UNKNOWN_TAG, INACTIVE, QUEUED, ERROR };

struct NetResult {
  uint32_t   seq;
  SendResult r;
  char       brinco[20];
  float      ganho;
  bool       hasGanho;
};

static QueueHandle_t qWeighings;   // flow -> net
static QueueHandle_t qResults;     // net -> flow (tamanho 1, xQueueOverwrite)

static portMUX_TYPE   scaleMux = portMUX_INITIALIZER_UNLOCKED;
static float          g_avgKg  = 0;      // média móvel (kg brutos da célula)
static bool           g_stable = false;
static volatile bool  g_reqTare  = false;
static volatile float g_reqCalKg = 0;
static volatile uint8_t g_pending = 0;

HX711            scale;
MFRC522          rfid(PIN_RFID_SS, PIN_RFID_RST);
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
Preferences      prefs;

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
static void readScale(float &kg, bool &stable) {
  portENTER_CRITICAL(&scaleMux);
  kg = g_avgKg;
  stable = g_stable;
  portEXIT_CRITICAL(&scaleMux);
}

static float displayKg(float rawKg) { return rawKg * WEIGHT_SCALE_MULTIPLIER; }

static bool isoNow(char *out, size_t n) {
  time_t now = time(nullptr);
  if (now < 1700000000) { out[0] = 0; return false; }   // NTP ainda não sincronizou
  struct tm t;
  gmtime_r(&now, &t);
  strftime(out, n, "%Y-%m-%dT%H:%M:%SZ", &t);
  return true;
}

static void beep(int freq, int ms) {
  tone(PIN_BUZZER, freq, ms);
  delay(ms + 20);
  noTone(PIN_BUZZER);
}
static void beepOk()    { beep(2400, 80); delay(60); beep(3000, 120); }
static void beepError() { beep(600, 400); }
static void beepWarn()  { beep(1200, 150); delay(80); beep(1200, 150); }

// ---------------------------------------------------------------------
// Display (somente taskFlow desenha após o boot -> sem mutex)
// ---------------------------------------------------------------------
static void uiStatusBar() {
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "WiFi --");
  if (g_pending > 0) {
    oled.setCursor(70, 0);
    oled.printf("Fila:%u", g_pending);
  }
  oled.drawFastHLine(0, 10, 128, SSD1306_WHITE);
}

static void uiIdle(float kg, bool stable) {
  oled.clearDisplay();
  uiStatusBar();
  oled.setTextSize(1);
  oled.setCursor(0, 16);
  oled.print("Aproxime a TAG RFID");
  oled.setTextSize(2);
  oled.setCursor(0, 34);
  oled.printf("%.3f kg", displayKg(kg < 0 ? 0 : kg));
  oled.setTextSize(1);
  oled.setCursor(0, 56);
  oled.print(stable ? "Estavel" : "...");
  oled.display();
}

static void uiWaiting(const char *tag, float kg, bool stable, uint32_t remainingMs) {
  oled.clearDisplay();
  uiStatusBar();
  oled.setTextSize(1);
  oled.setCursor(0, 14);
  oled.printf("TAG %s", tag);
  oled.setTextSize(2);
  oled.setCursor(0, 30);
  oled.printf("%.3f", displayKg(kg < 0 ? 0 : kg));
  oled.setTextSize(1);
  oled.setCursor(0, 56);
  oled.printf(stable ? "Estavel!" : "Estabilizando %lus", (unsigned long)(remainingMs / 1000));
  oled.display();
}

static void uiMsg(const char *title, const char *big, const char *foot) {
  oled.clearDisplay();
  uiStatusBar();
  oled.setTextSize(1);
  oled.setCursor(0, 14);
  oled.print(title);
  oled.setTextSize(2);
  oled.setCursor(0, 30);
  oled.print(big);
  oled.setTextSize(1);
  oled.setCursor(0, 56);
  oled.print(foot);
  oled.display();
}

// ---------------------------------------------------------------------
// RFID
// ---------------------------------------------------------------------
static bool readTag(char *out, size_t n) {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return false;
  size_t p = 0;
  for (byte i = 0; i < rfid.uid.size && p < n; i++) {
    p += snprintf(out + p, n - p, i ? ":%02X" : "%02X", rfid.uid.uidByte[i]);
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  return true;
}

// ---------------------------------------------------------------------
// Tarefa: Balança (média móvel + estabilidade)
// ---------------------------------------------------------------------
static void taskScale(void *) {
  float buf[MA_WINDOW] = {0};
  int idx = 0, count = 0;

  for (;;) {
    if (g_reqTare) {
      scale.tare(15);
      g_reqTare = false;
      idx = count = 0;
      Serial.println("[SCALE] Tara concluida");
    }
    if (g_reqCalKg > 0) {
      float refKg = g_reqCalKg;
      float factor = scale.get_value(20) / refKg;
      if (factor != 0) {
        scale.set_scale(factor);
        prefs.putFloat("cal", factor);
        Serial.printf("[SCALE] Calibrado: fator=%.2f (salvo)\n", factor);
      } else {
        Serial.println("[SCALE] Falha na calibracao (leitura zero)");
      }
      g_reqCalKg = 0;
      idx = count = 0;
    }

    if (scale.wait_ready_timeout(200)) {
      float v = scale.get_units(1);
      buf[idx] = v;
      idx = (idx + 1) % MA_WINDOW;
      if (count < MA_WINDOW) count++;

      float sum = 0, mn = 1e9, mx = -1e9;
      for (int i = 0; i < count; i++) {
        sum += buf[i];
        if (buf[i] < mn) mn = buf[i];
        if (buf[i] > mx) mx = buf[i];
      }
      float avg = sum / count;
      bool stable = (count == MA_WINDOW) &&
                    ((mx - mn) <= STABLE_TOLERANCE_KG) &&
                    (avg >= MIN_WEIGHT_KG);

      portENTER_CRITICAL(&scaleMux);
      g_avgKg = avg;
      g_stable = stable;
      portEXIT_CRITICAL(&scaleMux);
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// ---------------------------------------------------------------------
// Tarefa: Fluxo de pesagem
// ---------------------------------------------------------------------
static void taskFlow(void *) {
  char lastTag[24] = "";
  uint32_t lastTagAt = 0;
  uint32_t seq = 0;
  uint32_t lastIdleDraw = 0;

  for (;;) {
    float kg; bool st;
    readScale(kg, st);

    char tag[24];
    if (!readTag(tag, sizeof(tag))) {
      if (millis() - lastIdleDraw > 200) { uiIdle(kg, st); lastIdleDraw = millis(); }
      vTaskDelay(pdMS_TO_TICKS(80));
      continue;
    }

    if (strcmp(tag, lastTag) == 0 && millis() - lastTagAt < SAME_TAG_DEBOUNCE_MS) {
      vTaskDelay(pdMS_TO_TICKS(300));   // mesma tag recém pesada: ignora
      continue;
    }

    Serial.printf("[RFID] Tag %s\n", tag);
    beep(2000, 60);

    // Aguarda estabilização
    uint32_t t0 = millis();
    bool ok = false;
    while (millis() - t0 < TAG_WAIT_STABLE_MS) {
      readScale(kg, st);
      uiWaiting(tag, kg, st, TAG_WAIT_STABLE_MS - (millis() - t0));
      if (st) { ok = true; break; }
      vTaskDelay(pdMS_TO_TICKS(100));
    }
    if (!ok) {
      uiMsg("PESO INSTAVEL", "REPITA", kg < MIN_WEIGHT_KG ? "Balanca vazia" : "Animal se movendo");
      beepError();
      vTaskDelay(pdMS_TO_TICKS(RESULT_SHOW_MS));
      continue;
    }

    Weighing item{};
    strlcpy(item.tag, tag, sizeof(item.tag));
    item.kg = displayKg(kg);
    isoNow(item.ts, sizeof(item.ts));
    item.seq = ++seq;

    strlcpy(lastTag, tag, sizeof(lastTag));
    lastTagAt = millis();

    char big[16];
    snprintf(big, sizeof(big), "%.3f", item.kg);
    uiMsg("CAPTURADO (kg)", big, "Enviando...");
    beep(2600, 80);

    xQueueReset(qResults);
    if (xQueueSend(qWeighings, &item, pdMS_TO_TICKS(200)) != pdTRUE) {
      uiMsg("ERRO", "FILA", "Buffer cheio");
      beepError();
      vTaskDelay(pdMS_TO_TICKS(RESULT_SHOW_MS));
      continue;
    }

    // Espera a resposta do envio
    NetResult r{};
    bool got = false;
    uint32_t t1 = millis();
    while (millis() - t1 < HTTP_TIMEOUT_MS + 2000) {
      if (xQueueReceive(qResults, &r, pdMS_TO_TICKS(200)) == pdTRUE && r.seq == item.seq) { got = true; break; }
    }
    if (!got) r.r = SendResult::QUEUED;

    char foot[32];
    switch (r.r) {
      case SendResult::OK:
      case SendResult::DUPLICATE:
        if (r.hasGanho) snprintf(foot, sizeof(foot), "%s  %+.3f", r.brinco, r.ganho);
        else            snprintf(foot, sizeof(foot), "%s  1a pesagem", r.brinco);
        uiMsg("REGISTRADO", big, foot);
        beepOk();
        break;
      case SendResult::UNKNOWN_TAG:
        uiMsg("TAG NAO CADASTRADA", "?", tag);
        beepError();
        break;
      case SendResult::INACTIVE:
        uiMsg("ANIMAL INATIVO", "!", "Vendido/obito");
        beepError();
        break;
      case SendResult::QUEUED:
        uiMsg("SALVO OFFLINE", big, "Envia ao reconectar");
        beepWarn();
        break;
      default:
        uiMsg("ERRO NO ENVIO", "!", "Veja o Serial");
        beepError();
        break;
    }
    vTaskDelay(pdMS_TO_TICKS(RESULT_SHOW_MS));
  }
}

// ---------------------------------------------------------------------
// Rede
// ---------------------------------------------------------------------
static int postJson(const char *path, const String &body, String *resp) {
  HTTPClient http;
  String url = String(API_BASE_URL) + path;
  if (!http.begin(url)) return -1;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(body);
  if (resp && code > 0) *resp = http.getString();
  http.end();
  return code;
}

static int sendWeighing(const Weighing &w, NetResult &res) {
  JsonDocument doc;
  doc["device_id"]  = DEVICE_ID;
  doc["rfid_tag"]   = w.tag;
  doc["weight_kg"]  = serialized(String(w.kg, 3));
  if (w.ts[0]) doc["timestamp"] = w.ts;
  String body;
  serializeJson(doc, body);

  String resp;
  int code = postJson("/api/v1/weighings", body, &resp);
  Serial.printf("[NET] POST weighing %s -> %d %s\n", w.tag, code, resp.c_str());

  if (code == 200 || code == 201) {
    JsonDocument r;
    if (!deserializeJson(r, resp)) {
      strlcpy(res.brinco, r["brinco_visual"] | "", sizeof(res.brinco));
      res.hasGanho = !r["ganho_kg"].isNull();
      res.ganho = r["ganho_kg"] | 0.0f;
    }
  }
  return code;
}

static void sendTelemetry() {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  JsonArray arr = doc["readings"].to<JsonArray>();
  auto add = [&](const char *tipo, float v) {
    JsonObject o = arr.add<JsonObject>();
    o["tipo_sensor"] = tipo;
    o["valor"] = v;
  };
  add("rssi_wifi", WiFi.RSSI());
  add("temperatura_chip", temperatureRead());
  add("heap_livre_kb", ESP.getFreeHeap() / 1024.0f);
  add("uptime_s", millis() / 1000.0f);
  add("fila_pendente", g_pending);
#if PIN_BATTERY >= 0
  add("bateria_v", analogReadMilliVolts(PIN_BATTERY) * BATTERY_DIVIDER / 1000.0f);
#endif
  String body;
  serializeJson(doc, body);
  int code = postJson("/api/v1/telemetry", body, nullptr);
  Serial.printf("[NET] telemetria -> %d\n", code);
}

static Weighing pending[PENDING_MAX];
static int pHead = 0, pCount = 0;

static void taskNet(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  uint32_t lastHb = 0, nextRetry = 0, lastWifiTry = millis(), backoff = 2000;

  for (;;) {
    Weighing in;
    uint32_t freshSeq = 0;
    if (xQueueReceive(qWeighings, &in, pdMS_TO_TICKS(500)) == pdTRUE) {
      if (pCount == PENDING_MAX) {               // descarta a mais antiga
        pHead = (pHead + 1) % PENDING_MAX;
        pCount--;
        Serial.println("[NET] Buffer cheio: pesagem mais antiga descartada");
      }
      pending[(pHead + pCount) % PENDING_MAX] = in;
      pCount++;
      freshSeq = in.seq;
      nextRetry = 0;
    }

    if (WiFi.status() != WL_CONNECTED) {
      if (freshSeq) {
        NetResult r{}; r.seq = freshSeq; r.r = SendResult::QUEUED;
        xQueueOverwrite(qResults, &r);
      }
      if (millis() - lastWifiTry > 10000) {
        Serial.println("[NET] Reconectando Wi-Fi...");
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASS);
        lastWifiTry = millis();
      }
      g_pending = pCount;
      continue;
    }

    while (pCount > 0 && millis() >= nextRetry) {
      Weighing &w = pending[pHead];
      NetResult res{};
      res.seq = w.seq;
      int code = sendWeighing(w, res);

      bool drop = true;
      if (code == 201)                    res.r = SendResult::OK;
      else if (code == 200)               res.r = SendResult::DUPLICATE;
      else if (code == 404)               res.r = SendResult::UNKNOWN_TAG;
      else if (code == 409)               res.r = SendResult::INACTIVE;
      else if (code >= 400 && code < 500) res.r = SendResult::ERROR;   // payload/chave inválida: não adianta repetir
      else { res.r = SendResult::QUEUED; drop = false; }               // timeout / 5xx: tenta depois

      xQueueOverwrite(qResults, &res);

      if (drop) {
        pHead = (pHead + 1) % PENDING_MAX;
        pCount--;
        backoff = 2000;
      } else {
        nextRetry = millis() + backoff;
        backoff = std::min<uint32_t>(backoff * 2, 60000);
        break;
      }
    }
    g_pending = pCount;

    if (millis() - lastHb > HEARTBEAT_MS) {
      sendTelemetry();
      lastHb = millis();
    }
  }
}

// ---------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUZZER, OUTPUT);

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) Serial.println("[OLED] nao encontrado");
  oled.setTextColor(SSD1306_WHITE);
  oled.clearDisplay();
  oled.setTextSize(2);
  oled.setCursor(10, 10);
  oled.print("CowTag");
  oled.setTextSize(1);
  oled.setCursor(10, 40);
  oled.print("Tarando balanca...");
  oled.display();

  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_DumpVersionToSerial();

  prefs.begin("cowtag", false);
  float cal = prefs.getFloat("cal", DEFAULT_CAL_FACTOR);
  scale.begin(PIN_HX_DOUT, PIN_HX_SCK);
  scale.set_scale(cal);
  scale.tare(20);
  Serial.printf("[SCALE] fator=%.2f, tara ok\n", cal);

  qWeighings = xQueueCreate(8, sizeof(Weighing));
  qResults   = xQueueCreate(1, sizeof(NetResult));

  xTaskCreatePinnedToCore(taskScale, "scale", 4096, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(taskFlow,  "flow",  6144, nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(taskNet,   "net",   8192, nullptr, 1, nullptr, 0);

  beep(2000, 100);
  Serial.println("Comandos: t = tara | c <gramas> = calibrar | i = info");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line == "t") {
      g_reqTare = true;
    } else if (line.startsWith("c ")) {
      float grams = line.substring(2).toFloat();
      if (grams > 0) { g_reqCalKg = grams / 1000.0f; Serial.printf("Calibrando com %.1f g...\n", grams); }
    } else if (line == "i") {
      float kg; bool st; readScale(kg, st);
      Serial.printf("peso=%.4f kg estavel=%d wifi=%d ip=%s fila=%u fator=%.2f\n",
                    kg, st, WiFi.status() == WL_CONNECTED, WiFi.localIP().toString().c_str(),
                    g_pending, scale.get_scale());
    }
  }
  vTaskDelay(pdMS_TO_TICKS(50));
}
