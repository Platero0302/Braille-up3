/*
  BRAILLE UP! - Firmware educacional para uma celula Braille de 6 pontos

  Baseado na disposicao fisica do projeto de referencia:

      1 4
      2 5
      3 6

  Pinos de controle dos solenoides: 2, 3, 4, 5, 6 e 7.
  Botao opcional: pino 8.

  Protocolo Serial (9600 baud):
    PING        -> responde PONG
    CLEAR       -> abaixa todos os pontos
    CHAR:A      -> mostra a letra A
    DOTS:145    -> levanta diretamente os pontos 1, 4 e 5
    TEST        -> testa os seis solenoides, um de cada vez

  IMPORTANTE:
  - Os solenoides NAO devem ser alimentados diretamente pelos pinos do Arduino.
  - Use o circuito de acionamento com MOSFET e diodo de protecao (flyback).
  - Arduino e fonte externa devem compartilhar o GND.
  - Nao una o barramento de 5 V ao barramento de 12 V.
  - Confirme a tensao, corrente e regime de trabalho do solenoide utilizado.
*/

const byte SOLENOID_COUNT = 6;
const byte controlPins[SOLENOID_COUNT] = {2, 3, 4, 5, 6, 7};
const byte buttonPin = 8;

// Tempo de seguranca para evitar manter a celula energizada indefinidamente.
// Ajuste somente depois de confirmar as especificacoes dos solenoides.
const unsigned long MAX_ACTIVE_MS = 5000;
unsigned long lastActivationMs = 0;
bool anyActive = false;

// Padroes a-z. Cada coluna representa os pontos 1..6.
const byte braille[26][6] = {
  {1,0,0,0,0,0}, // a
  {1,1,0,0,0,0}, // b
  {1,0,0,1,0,0}, // c
  {1,0,0,1,1,0}, // d
  {1,0,0,0,1,0}, // e
  {1,1,0,1,0,0}, // f
  {1,1,0,1,1,0}, // g
  {1,1,0,0,1,0}, // h
  {0,1,0,1,0,0}, // i
  {0,1,0,1,1,0}, // j
  {1,0,1,0,0,0}, // k
  {1,1,1,0,0,0}, // l
  {1,0,1,1,0,0}, // m
  {1,0,1,1,1,0}, // n
  {1,0,1,0,1,0}, // o
  {1,1,1,1,0,0}, // p
  {1,1,1,1,1,0}, // q
  {1,1,1,0,1,0}, // r
  {0,1,1,1,0,0}, // s
  {0,1,1,1,1,0}, // t
  {1,0,1,0,0,1}, // u
  {1,1,1,0,0,1}, // v
  {0,1,0,1,1,1}, // w
  {1,0,1,1,0,1}, // x
  {1,0,1,1,1,1}, // y
  {1,0,1,0,1,1}  // z
};

String inputLine = "";

void clearCell() {
  for (byte i = 0; i < SOLENOID_COUNT; i++) {
    digitalWrite(controlPins[i], LOW);
  }
  anyActive = false;
}

void applyPattern(const byte pattern[6]) {
  anyActive = false;
  for (byte i = 0; i < SOLENOID_COUNT; i++) {
    digitalWrite(controlPins[i], pattern[i] ? HIGH : LOW);
    if (pattern[i]) anyActive = true;
  }
  if (anyActive) lastActivationMs = millis();
}

bool showLetter(char c) {
  c = tolower(c);
  if (c < 'a' || c > 'z') {
    clearCell();
    return false;
  }

  byte index = c - 'a';
  applyPattern(braille[index]);
  return true;
}

void showDots(String dots) {
  byte pattern[6] = {0,0,0,0,0,0};

  for (unsigned int i = 0; i < dots.length(); i++) {
    char c = dots[i];
    if (c >= '1' && c <= '6') {
      pattern[c - '1'] = 1;
    }
  }

  applyPattern(pattern);
}

void testSolenoids() {
  clearCell();
  for (byte i = 0; i < SOLENOID_COUNT; i++) {
    digitalWrite(controlPins[i], HIGH);
    delay(600);
    digitalWrite(controlPins[i], LOW);
    delay(250);
  }
  Serial.println("TEST:OK");
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "PING") {
    Serial.println("PONG");
    return;
  }

  if (cmd == "CLEAR") {
    clearCell();
    Serial.println("CLEAR:OK");
    return;
  }

  if (cmd == "TEST") {
    testSolenoids();
    return;
  }

  if (cmd.startsWith("CHAR:")) {
    String value = cmd.substring(5);
    value.trim();
    if (value.length() > 0 && showLetter(value.charAt(0))) {
      Serial.print("CHAR:OK:");
      Serial.println(value.charAt(0));
    } else {
      Serial.println("CHAR:ERRO");
    }
    return;
  }

  if (cmd.startsWith("DOTS:")) {
    showDots(cmd.substring(5));
    Serial.println("DOTS:OK");
    return;
  }

  Serial.println("ERRO:COMANDO_DESCONHECIDO");
}

void setup() {
  Serial.begin(9600);

  for (byte i = 0; i < SOLENOID_COUNT; i++) {
    pinMode(controlPins[i], OUTPUT);
  }
  pinMode(buttonPin, INPUT);

  clearCell();
  Serial.println("BRAILLE_UP:READY");
}

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputLine.length() > 0) {
        processCommand(inputLine);
        inputLine = "";
      }
    } else {
      inputLine += c;
      // Evita crescimento indefinido caso chegue dado invalido.
      if (inputLine.length() > 80) inputLine = "";
    }
  }

  // Desliga automaticamente depois do tempo limite configurado.
  if (anyActive && millis() - lastActivationMs >= MAX_ACTIVE_MS) {
    clearCell();
    Serial.println("SAFETY:CLEAR");
  }
}
