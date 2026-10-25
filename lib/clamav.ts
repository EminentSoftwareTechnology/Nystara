import { connect } from "node:net";

const CHUNK = 64 * 1024;

export function clamavConfig() {
  const host = process.env.CLAMAV_HOST;
  if (!host) return null;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  return Number.isInteger(port) && port > 0 && port < 65536 ? { host, port } : null;
}

/** Streams bytes to clamd with INSTREAM. Resolves the signature name when infected, null when clean. */
export function clamavScan(
  bytes: Buffer,
  config: { host: string; port: number },
  timeoutMs = 10_000,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const socket = connect(config);
    const replies: Buffer[] = [];
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("ClamAV scan timed out")));
    socket.on("error", reject);
    socket.on("data", (chunk) => replies.push(chunk));
    socket.on("end", () => {
      const reply = Buffer.concat(replies).toString("utf8").replace(/\0/g, "").trim();
      const found = /^stream: (.+) FOUND$/.exec(reply);
      if (found) resolve(found[1]);
      else if (reply === "stream: OK") resolve(null);
      else reject(new Error("Unexpected ClamAV reply"));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        const chunk = bytes.subarray(offset, offset + CHUNK);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}
