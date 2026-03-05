#include "esp_camera.h"
#include <WiFi.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

// ===========================
// GPS Configuration
// ===========================
TinyGPSPlus gps;
HardwareSerial gpsSerial(1); 
#define GPS_RX_PIN 1  
#define GPS_TX_PIN 2  

// Variabel untuk mengatur jeda tampilan
unsigned long lastDisplayTime = 0;
const unsigned long displayInterval = 2000; // Tampilkan setiap 2000ms (2 detik)

#include "board_config.h"

const char *ssid = "istela";
const char *password = "KeluargaCemara";

void startCameraServer();
void setupLedFlash();

// ===========================
// Fungsi Display GPS & RSSI
// ===========================
void displayTelemetryInfo() {
  if (millis() - lastDisplayTime >= displayInterval) {
    Serial.println("\n--- [ TELEMETRY DRONE ] ---");
    
    // 1. Cek Kekuatan Sinyal WiFi (RSSI)
    if (WiFi.status() == WL_CONNECTED) {
      long rssi = WiFi.RSSI();
      Serial.print("Sinyal WiFi : "); 
      Serial.print(rssi); 
      Serial.println(" dBm");
    } else {
      Serial.println("Sinyal WiFi : TERPUTUS!");
    }

    // 2. Cek Data GPS
    if (gps.location.isValid()) {
      Serial.print("Latitude  : "); Serial.println(gps.location.lat(), 6);
      Serial.print("Longitude : "); Serial.println(gps.location.lng(), 6);
      Serial.print("Altitude  : "); Serial.print(gps.altitude.meters()); Serial.println(" m");
      Serial.print("Satelit   : "); Serial.println(gps.satellites.value());
    } else {
      Serial.println("GPS       : Mencari sinyal satelit...");
    }
    
    Serial.println("---------------------------");
    lastDisplayTime = millis(); // Update waktu terakhir tampil
  }
}

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi GPS
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  Serial.setDebugOutput(true);
  Serial.println();

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 22000000;
  config.frame_size = FRAMESIZE_QVGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 15;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  
  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");
}

void loop() {
  // Selalu baca data dari GPS (agar buffer tidak penuh)
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Tampilkan info Telemetri (GPS + RSSI) dengan jeda waktu
  displayTelemetryInfo();

  // Peringatan jika modul GPS tidak terdeteksi
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) { // Cek tiap 10 detik
    if (gps.charsProcessed() < 10) {
      Serial.println("Kesalahan: Data GPS tidak masuk. Cek koneksi pin TX/RX!");
    }
    lastCheck = millis();
  }
}