let port = null;
let writer = null;

export function serialSupported() {
  return "serial" in navigator;
}

export async function connectSerial() {
  if (!serialSupported()) {
    throw new Error("Web Serial nao esta disponivel neste navegador.");
  }

  port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  writer = port.writable.getWriter();
  return true;
}

export async function disconnectSerial() {
  if (writer) {
    writer.releaseLock();
    writer = null;
  }
  if (port) {
    await port.close();
    port = null;
  }
}

export function isConnected() {
  return Boolean(port && writer);
}

export async function sendCommand(command) {
  if (!writer) return false;
  const data = new TextEncoder().encode(`${command}\n`);
  await writer.write(data);
  return true;
}
