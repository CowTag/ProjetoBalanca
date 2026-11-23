#pragma once
// =====================================================================
//  CowTag - Configuração do firmware
// =====================================================================

// ---------- Wi-Fi ----------
#define WIFI_SSID        "SUA_REDE_WIFI"
#define WIFI_PASS        "SUA_SENHA_WIFI"

// ---------- API ----------
#define API_BASE_URL     "http://192.168.0.10:3000"
#define DEVICE_ID        "BALANCA_ESP32_01"     
#define DEVICE_KEY       "dev-key-balanca-01"   

#define USE_OLED           0          
#define USE_LOCAL_WEB      1          
#define MDNS_NAME          "cowtag-balanca"   
#define LIVE_PUSH_MIN_MS   1000       
#define LIVE_KEEPALIVE_MS  10000      

// ---------- Pinagem ----------
// MFRC522 
#define PIN_RFID_SS      5
#define PIN_RFID_RST     27
// HX711
#define PIN_HX_DOUT      32
#define PIN_HX_SCK       33
// OLED SSD1306 I2C 128x64 
#define PIN_OLED_SDA     21
#define PIN_OLED_SCL     22
#define OLED_ADDR        0x3C
// LED de status
#define PIN_STATUS_LED       2
#define STATUS_LED_ACTIVE_LOW 0       
// Bateria via divisor 
#define PIN_BATTERY      -1
#define BATTERY_DIVIDER  2.0f

// ---------- Balança ----------
#define DEFAULT_CAL_FACTOR    420000.0f
#define MA_WINDOW             10        
#define STABLE_TOLERANCE_KG   0.004f    
#define MIN_WEIGHT_KG         0.020f    
// Multiplicador aplicado só na exibição.
#define WEIGHT_SCALE_MULTIPLIER 1.0f

// ---------- Tempos ----------
#define TAG_WAIT_STABLE_MS    10000     
#define SAME_TAG_DEBOUNCE_MS  15000     
#define RESULT_SHOW_MS        2500
#define HEARTBEAT_MS          30000     
#define HTTP_TIMEOUT_MS       5000
#define PENDING_MAX           32        
