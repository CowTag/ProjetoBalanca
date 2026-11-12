// =====================================================================
//  CowTag - Firmware da balança pecuária (ESP32 + FreeRTOS)
//
//  Sem buzzer. OLED opcional (USE_OLED). O acompanhamento é feito por:
//   - Monitor Serial (logs [ESTADO], [PESO], [NET])
//   - Página local no ESP32 (http://cowtag-balanca.local)
//   - Dashboard web, painel "Balança ao vivo" (POST /api/v1/live)
//   - LED onboard (GPIO 2)
//
//  Tarefas:
//   - taskScale (core 1): lê HX711 ~10 Hz, média móvel + detecção de estabilidade
//   - taskFlow  (core 1): RFID -> espera peso estável -> captura -> resultado
//   - taskNet   (core 0): Wi-Fi, NTP, envio HTTP com buffer offline, telemetria, ao vivo
//   - taskWeb   (core 0): página/JSON de status local
//   - taskLed   (core 1): padrões de piscada do LED
//   - loop()          : comandos Serial (t = tara, c <gramas> = calibrar, i = info)
// =====================================================================
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <SPI.h>
#include <MFRC522.h>
#include <HX711.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include "config.h"
#include "web_page.h"

#if USE_OLED
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
#endif

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

// Estado "ao vivo" exibido no Serial, na página local e no dashboard
struct LiveState {
  char     estado[24];   // AGUARDANDO_TAG, ESTABILIZANDO, ENVIANDO, REGISTRADO, ...
  char     tag[24];
  char     msg[64];
  uint32_t version;      // incrementa a cada mudança
};

enum class LedEvent : uint8_t { NONE, TAG, OK, ERROR, WARN };

static QueueHandle_t     qWeighings;   // flow -> net
static QueueHandle_t     qResults;     // net -> flow (tamanho 1, xQueueOverwrite)
static SemaphoreHandle_t liveMux;

static portMUX_TYPE   scaleMux = portMUX_INITIALIZER_UNLOCKED;
static float          g_avgKg  = 0;      // média móvel (kg brutos da célula)
static bool           g_stable = false;
static float          g_stability = 0;   // 0..1 (para a barra da página local)
static volatile bool  g_reqTare  = false;
static volatile float g_reqCalKg = 0;
static volatile uint8_t g_pending = 0;
static volatile bool  g_serverOk = false;
static volatile LedEvent g_ledEvent = LedEvent::NONE;
static volatile bool  g_ledSolid = false;
static LiveState      g_live{};

HX711       scale;
MFRC522     rfid(PIN_RFID_SS, PIN_RFID_RST);
Preferences prefs;
#if USE_LOCAL_WEB
WebServer   web(80);
#endif

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
static void readScale(float &kg, bool &stable, float *stability = nullptr) {
  portENTER_CRITICAL(&scaleMux);
  kg = g_avgKg;
  stable = g_stable;
  if (stability) *stability = g_stability;
  portEXIT_CRITICAL(&scaleMux);
}

static float displayKg(float rawKg) { return (rawKg < 0 ? 0 : rawKg) * WEIGHT_SCALE_MULTIPLIER; }

static bool isoNow(char *out, size_t n) {
  time_t now = time(nullptr);
  if (now < 1700000000) { out[0] = 0; return false; }   // NTP ainda não sincronizou
  struct tm t;
  gmtime_r(&now, &t);
  strftime(out, n, "%Y-%m-%dT%H:%M:%SZ", &t);
  return true;
}

/** Atualiza o estado ao vivo e registra no Serial quando muda. */
static void setLive(const char *estado, const char *tag, const char *fmt, ...) {
  char msg[64];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(msg, sizeof(msg), fmt, ap);
  va_end(ap);

  bool changed = false;
  xSemaphoreTake(liveMux, portMAX_DELAY);
  if (strcmp(g_live.estado, estado) || strcmp(g_live.tag, tag) || strcmp(g_live.msg, msg)) {
    strlcpy(g_live.estado, estado, sizeof(g_live.estado));
    strlcpy(g_live.tag, tag, sizeof(g_live.tag));
    strlcpy(g_live.msg, msg, sizeof(g_live.msg));
    g_live.version++;
    changed = true;
  }
  xSemaphoreGive(liveMux);
  if (changed) Serial.printf("[ESTADO] %-18s tag=%-14s %s\n", estado, tag[0] ? tag : "-", msg);
}

static LiveState getLive() {
  xSemaphoreTake(liveMux, portMAX_DELAY);
  LiveState s = g_live;
  xSemaphoreGive(liveMux);
  return s;
}

// ---------------------------------------------------------------------
// LED de status (substitui o buzzer)
//  1 piscada curta  = tag lida        | aceso fixo = estabilizando
//  2 piscadas       = registrado      | 1 longa    = erro / tag não cadastrada
//  3 piscadas       = salvo offline   | pisca lento = sem Wi-Fi
// ---------------------------------------------------------------------
static void ledWrite(bool on) {
#if PIN_STATUS_LED >= 0
  digitalWrite(PIN_STATUS_LED, (on ^ STATUS_LED_ACTIVE_LOW) ? HIGH : LOW);
#endif
}

static void blinkN(int n, int onMs, int offMs) {
  for (int i = 0; i < n; i++) {
    ledWrite(true);  vTaskDelay(pdMS_TO_TICKS(onMs));
    ledWrite(false); vTaskDelay(pdMS_TO_TICKS(offMs));
  }
}

static void taskLed(void *) {
  for (;;) {
    LedEvent e = g_ledEvent;
    if (e != LedEvent::NONE) {
      g_ledEvent = LedEvent::NONE;
      switch (e) {
        case LedEvent::TAG:   blinkN(1, 60, 100); break;
        case LedEvent::OK:    blinkN(2, 120, 120); break;
        case LedEvent::ERROR: blinkN(1, 900, 200); break;
        case LedEvent::WARN:  blinkN(3, 90, 90); break;
        default: break;
      }
    } else if (g_ledSolid) {
      ledWrite(true);
      vTaskDelay(pdMS_TO_TICKS(50));
    } else if (WiFi.status() != WL_CONNECTED) {
      blinkN(1, 80, 920);
    } else {
      ledWrite(false);
      vTaskDelay(pdMS_TO_TICKS(50));
    }
  }
}

static void feedback(LedEvent e) { g_ledEvent = e; }

// ---------------------------------------------------------------------
// OLED (opcional)
// ---------------------------------------------------------------------
#if USE_OLED
static void oledShow(const char *title, const char *big, const char *foot) {
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "WiFi --");
  if (g_pending > 0) { oled.setCursor(70, 0); oled.printf("Fila:%u", g_pending); }
  oled.drawFastHLine(0, 10, 128, SSD1306_WHITE);
  oled.setCursor(0, 14); oled.print(title);
  oled.setTextSize(2); oled.setCursor(0, 30); oled.print(big);
  oled.setTextSize(1); oled.setCursor(0, 56); oled.print(foot);
  oled.display();
}
#else
static inline void oledShow(const char *, const char *, const char *) {}
#endif

static void oledWeight(const char *title, float kg, const char *foot) {
#if USE_OLED
  char big[16];
  snprintf(big, sizeof(big), "%.3f kg", displayKg(kg));
  oledShow(title, big, foot);
#endif
}

// ---------------------------------------------------------------------
// RFID
// ---------------------------------------------------------------------
/** Inicializa o MFRC522 e confere se ele responde no SPI. */
static bool rfidInit(bool verbose) {
  rfid.PCD_Init();
  delay(5);
  rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  bool ok = v != 0x00 && v != 0xFF;
  if (verbose || !ok) {
    if (ok) Serial.printf("[RFID] MFRC522 ok (versao 0x%02X)\n", v);
    else    Serial.printf("[RFID] MFRC522 NAO responde (0x%02X): confira 3.3V, GND, SDA=%d, SCK=18, MOSI=23, MISO=19, RST=%d\n",
                          v, PIN_RFID_SS, PIN_RFID_RST);
  }
  return ok;
}

/** Verifica periodicamente se o leitor travou (ruído/queda de tensão) e reinicia. */
static void rfidHealthCheck() {
  static uint32_t last = 0;
  if (millis() - last < 3000) return;
  last = millis();
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  byte tx = rfid.PCD_ReadRegister(MFRC522::TxControlReg);
  if (v == 0x00 || v == 0xFF || (tx & 0x03) != 0x03) {   // sem resposta ou antena desligada
    Serial.printf("[RFID] leitor travado (ver=0x%02X tx=0x%02X), reiniciando...\n", v, tx);
    rfidInit(false);
  }
}

static bool readTag(char *out, size_t n) {
  // REQA só detecta cartões em IDLE. Se a tag ficou no leitor após um HaltA
  // (ex.: pesagem instável), é preciso WUPA para acordá-la de novo.
  if (!rfid.PICC_IsNewCardPresent()) {
    byte atqa[2]; byte sz = sizeof(atqa);
    MFRC522::StatusCode s = rfid.PICC_WakeupA(atqa, &sz);
    if (s != MFRC522::STATUS_OK && s != MFRC522::STATUS_COLLISION) return false;
  }
  if (!rfid.PICC_ReadCardSerial()) return false;
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
      float range = mx - mn;
      bool stable = (count == MA_WINDOW) && (range <= STABLE_TOLERANCE_KG) && (avg >= MIN_WEIGHT_KG);
      float stab = avg < MIN_WEIGHT_KG ? 0
                 : ((float)count / MA_WINDOW) * std::min(1.0f, STABLE_TOLERANCE_KG / std::max(range, 1e-6f));

      portENTER_CRITICAL(&scaleMux);
      g_avgKg = avg;
      g_stable = stable;
      g_stability = stab;
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
  uint32_t lastTagAt = 0, seq = 0, lastIdle = 0, lastWeightLog = 0;
  float lastLoggedKg = -1;

  for (;;) {
    float kg; bool st;
    readScale(kg, st);

    char tag[24];
    if (!readTag(tag, sizeof(tag))) {
      rfidHealthCheck();
      if (millis() - lastIdle > 250) {
        setLive("AGUARDANDO_TAG", "", kg >= MIN_WEIGHT_KG ? "Peso na balanca, aproxime a tag" : "Balanca vazia");
        oledWeight("Aproxime a TAG", kg, st ? "Estavel" : "...");
        lastIdle = millis();
      }
      // Log de peso no Serial a cada 1 s quando muda
      if (millis() - lastWeightLog > 1000 && fabsf(kg - lastLoggedKg) > STABLE_TOLERANCE_KG / 2) {
        Serial.printf("[PESO] %.3f kg %s\n", displayKg(kg), st ? "(estavel)" : "");
        lastLoggedKg = kg;
        lastWeightLog = millis();
      }
      vTaskDelay(pdMS_TO_TICKS(80));
      continue;
    }

    if (strcmp(tag, lastTag) == 0 && millis() - lastTagAt < SAME_TAG_DEBOUNCE_MS) {
      static uint32_t lastIgnLog = 0;
      if (millis() - lastIgnLog > 3000) {
        Serial.printf("[RFID] %s ignorada (mesma tag ha menos de %us)\n", tag, SAME_TAG_DEBOUNCE_MS / 1000);
        lastIgnLog = millis();
      }
      vTaskDelay(pdMS_TO_TICKS(300));   // mesma tag recém pesada: ignora
      continue;
    }
    Serial.printf("[RFID] tag lida: %s\n", tag);

    feedback(LedEvent::TAG);
    g_ledSolid = true;

    // Aguarda estabilização
    uint32_t t0 = millis();
    bool ok = false;
    while (millis() - t0 < TAG_WAIT_STABLE_MS) {
      readScale(kg, st);
      uint32_t rest = (TAG_WAIT_STABLE_MS - (millis() - t0)) / 1000;
      setLive("ESTABILIZANDO", tag, "%.3f kg - aguardando (%lus)", displayKg(kg), (unsigned long)rest);
      oledWeight(tag, kg, "Estabilizando...");
      if (st) { ok = true; break; }
      vTaskDelay(pdMS_TO_TICKS(150));
    }
    g_ledSolid = false;

    if (!ok) {
      setLive("PESO_INSTAVEL", tag, kg < MIN_WEIGHT_KG ? "Balanca vazia - repita" : "Animal se movendo - repita");
      oledShow("PESO INSTAVEL", "REPITA", "");
      feedback(LedEvent::ERROR);
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
    setLive("ENVIANDO", tag, "%s kg capturado", big);
    oledShow("CAPTURADO (kg)", big, "Enviando...");

    xQueueReset(qResults);
    if (xQueueSend(qWeighings, &item, pdMS_TO_TICKS(200)) != pdTRUE) {
      setLive("ERRO", tag, "Fila interna cheia");
      feedback(LedEvent::ERROR);
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

    switch (r.r) {
      case SendResult::OK:
      case SendResult::DUPLICATE:
        if (r.hasGanho) setLive("REGISTRADO", tag, "%s kg - %s - ganho %+.3f kg", big, r.brinco, r.ganho);
        else            setLive("REGISTRADO", tag, "%s kg - %s - 1a pesagem", big, r.brinco);
        oledShow("REGISTRADO", big, r.brinco);
        feedback(LedEvent::OK);
        break;
      case SendResult::UNKNOWN_TAG:
        setLive("TAG_NAO_CADASTRADA", tag, "Cadastre esta tag no dashboard");
        oledShow("TAG NAO CADASTRADA", "?", tag);
        feedback(LedEvent::ERROR);
        break;
      case SendResult::INACTIVE:
        setLive("ANIMAL_INATIVO", tag, "Animal vendido ou obito");
        oledShow("ANIMAL INATIVO", "!", "");
        feedback(LedEvent::ERROR);
        break;
      case SendResult::QUEUED:
        setLive("SALVO_OFFLINE", tag, "%s kg - sera enviado ao reconectar", big);
        oledShow("SALVO OFFLINE", big, "Envia ao reconectar");
        feedback(LedEvent::WARN);
        break;
      default:
        setLive("ERRO", tag, "Falha no envio - veja o Serial");
        oledShow("ERRO NO ENVIO", "!", "");
        feedback(LedEvent::ERROR);
        break;
    }
    vTaskDelay(pdMS_TO_TICKS(RESULT_SHOW_MS));
  }
}

// ---------------------------------------------------------------------
// Rede
// ---------------------------------------------------------------------
static int postJson(const char *path, const String &body, String *resp, uint16_t timeoutMs = HTTP_TIMEOUT_MS) {
  HTTPClient http;
  String url = String(API_BASE_URL) + path;
  if (!http.begin(url)) return -1;
  http.setTimeout(timeoutMs);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(body);
  if (resp && code > 0) *resp = http.getString();
  http.end();
  g_serverOk = code > 0 && code < 500;
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
  Serial.printf("[NET] POST /weighings %s %.3f kg -> %d %s\n", w.tag, w.kg, code, resp.c_str());

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

/** Estado ao vivo para o dashboard (não é gravado no banco). */
static void sendLive(const LiveState &s, float kg, bool stable) {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["estado"]    = s.estado;
  doc["peso_kg"]   = serialized(String(displayKg(kg), 3));
  doc["estavel"]   = stable;
  doc["tag"]       = s.tag;
  doc["mensagem"]  = s.msg;
  doc["fila"]      = g_pending;
  doc["ip"]        = WiFi.localIP().toString();
  doc["wifi_rssi"] = WiFi.RSSI();
  String body;
  serializeJson(doc, body);
  postJson("/api/v1/live", body, nullptr, 2000);
}

static Weighing pending[PENDING_MAX];
static int pHead = 0, pCount = 0;

static const char *wifiReasonText(uint8_t r) {
  switch (r) {
    case 2:   return "autenticacao expirou";
    case 8:   return "saiu da rede";
    case 15:  return "handshake falhou (senha errada?)";
    case 200: return "beacon timeout (sinal fraco)";
    case 201: return "rede nao encontrada (SSID errado ou rede 5 GHz?)";
    case 202: return "falha de autenticacao (senha errada?)";
    case 203: return "falha de associacao";
    case 204: return "handshake timeout (senha errada?)";
    default:  return "";
  }
}

static void taskNet(void *) {
  if (strcmp(WIFI_SSID, "SUA_REDE_WIFI") == 0)
    Serial.println("[NET] ATENCAO: WIFI_SSID/WIFI_PASS ainda nao foram configurados em include/config.h");

  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) {
    uint8_t r = info.wifi_sta_disconnected.reason;
    Serial.printf("[NET] Wi-Fi desconectado, motivo %u %s\n", r, wifiReasonText(r));
  }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);            // modem-sleep causa quedas e latência na STA
  WiFi.setAutoReconnect(true);     // o próprio driver reconecta após uma queda
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  uint32_t lastHb = 0, nextRetry = 0, lastWifiTry = millis(), backoff = 2000;
  uint32_t wifiRetryMs = 30000;    // só força reconexão se o auto-reconnect não resolver
  uint32_t lastLive = 0, lastLiveVersion = 0;
  float lastLiveKg = -1;
  bool wasConnected = false;

  for (;;) {
    Weighing in;
    uint32_t freshSeq = 0;
    if (xQueueReceive(qWeighings, &in, pdMS_TO_TICKS(200)) == pdTRUE) {
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

    bool connected = WiFi.status() == WL_CONNECTED;
    if (connected && !wasConnected) {
      Serial.printf("[NET] Wi-Fi conectado. IP %s  ->  abra http://%s.local ou http://%s\n",
                    WiFi.localIP().toString().c_str(), MDNS_NAME, WiFi.localIP().toString().c_str());
      MDNS.end();
      if (MDNS.begin(MDNS_NAME)) MDNS.addService("http", "tcp", 80);
      wifiRetryMs = 30000;
    }
    if (!connected && wasConnected) lastWifiTry = millis();   // dá tempo ao auto-reconnect
    wasConnected = connected;

    if (!connected) {
      g_serverOk = false;
      if (freshSeq) {
        NetResult r{}; r.seq = freshSeq; r.r = SendResult::QUEUED;
        xQueueOverwrite(qResults, &r);
      }
      if (millis() - lastWifiTry > wifiRetryMs) {
        Serial.printf("[NET] Sem Wi-Fi ha %lus, forcando reconexao...\n", (unsigned long)(wifiRetryMs / 1000));
        if (!WiFi.reconnect()) WiFi.begin(WIFI_SSID, WIFI_PASS);
        lastWifiTry = millis();
        wifiRetryMs = std::min<uint32_t>(wifiRetryMs * 2, 120000);
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

    // Estado ao vivo -> dashboard (quando muda ou a cada LIVE_KEEPALIVE_MS)
    if (millis() - lastLive >= LIVE_PUSH_MIN_MS) {
      LiveState s = getLive();
      float kg; bool st;
      readScale(kg, st);
      bool changed = s.version != lastLiveVersion || fabsf(kg - lastLiveKg) > STABLE_TOLERANCE_KG;
      if (changed || millis() - lastLive >= LIVE_KEEPALIVE_MS) {
        sendLive(s, kg, st);
        lastLiveVersion = s.version;
        lastLiveKg = kg;
        lastLive = millis();
      }
    }

    if (millis() - lastHb > HEARTBEAT_MS) {
      sendTelemetry();
      lastHb = millis();
    }
  }
}

// ---------------------------------------------------------------------
// Página de status local
// ---------------------------------------------------------------------
#if USE_LOCAL_WEB
static void handleStatus() {
  LiveState s = getLive();
  float kg, stab; bool st;
  readScale(kg, st, &stab);
  JsonDocument doc;
  doc["device_id"]   = DEVICE_ID;
  doc["estado"]      = s.estado;
  doc["tag"]         = s.tag;
  doc["mensagem"]    = s.msg;
  doc["peso_kg"]     = displayKg(kg);
  doc["estavel"]     = st;
  doc["estabilidade"] = stab;
  doc["fila"]        = g_pending;
  doc["wifi_rssi"]   = WiFi.RSSI();
  doc["servidor_ok"] = (bool)g_serverOk;
  doc["ip"]          = WiFi.localIP().toString();
  doc["uptime_s"]    = millis() / 1000;
  doc["fator"]       = scale.get_scale();
  String out;
  serializeJson(doc, out);
  web.sendHeader("Access-Control-Allow-Origin", "*");
  web.send(200, "application/json", out);
}

static void taskWeb(void *) {
  web.on("/", HTTP_GET, [] { web.send_P(200, "text/html; charset=utf-8", WEB_PAGE); });
  web.on("/status", HTTP_GET, handleStatus);
  web.on("/tare", HTTP_POST, [] { g_reqTare = true; web.send(200, "application/json", "{\"ok\":true}"); });
  web.on("/calibrate", HTTP_POST, [] {
    float g = web.arg("g").toFloat();
    if (g <= 0) { web.send(400, "application/json", "{\"error\":\"informe ?g=<gramas>\"}"); return; }
    g_reqCalKg = g / 1000.0f;
    web.send(200, "application/json", "{\"ok\":true}");
  });
  web.onNotFound([] { web.send(404, "text/plain", "nao encontrado"); });
  web.begin();
  for (;;) {
    web.handleClient();
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}
#endif

// ---------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== CowTag balanca ===");

#if PIN_STATUS_LED >= 0
  pinMode(PIN_STATUS_LED, OUTPUT);
  ledWrite(true);
#endif

  liveMux = xSemaphoreCreateMutex();
  strlcpy(g_live.estado, "INICIANDO", sizeof(g_live.estado));

#if USE_OLED
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) Serial.println("[OLED] nao encontrado (siga sem display)");
  oled.setTextColor(SSD1306_WHITE);
  oledShow("CowTag", "INICIANDO", "Tarando balanca...");
#endif

  SPI.begin();
  rfidInit(true);

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
#if USE_LOCAL_WEB
  xTaskCreatePinnedToCore(taskWeb,   "web",   6144, nullptr, 1, nullptr, 0);
#endif
#if PIN_STATUS_LED >= 0
  xTaskCreatePinnedToCore(taskLed,   "led",   2048, nullptr, 1, nullptr, 1);
#endif

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
      LiveState s = getLive();
      Serial.printf("estado=%s peso=%.4f kg estavel=%d wifi=%d ip=%s servidor=%d fila=%u fator=%.2f\n",
                    s.estado, displayKg(kg), st, WiFi.status() == WL_CONNECTED,
                    WiFi.localIP().toString().c_str(), (bool)g_serverOk, g_pending, scale.get_scale());
    }
  }
  vTaskDelay(pdMS_TO_TICKS(50));
}
