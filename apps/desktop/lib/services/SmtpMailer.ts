import net from "net";
import tls from "tls";
import crypto from "crypto";

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface SmtpAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SmtpMailOptions {
  from: string;
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  attachments?: SmtpAttachment[];
}

function encodeMimeHeader(value: string): string {
  const clean = String(value || "").replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean;
  }
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function chunkBase64(b64: string, lineLength = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += lineLength) {
    chunks.push(b64.slice(i, i + lineLength));
  }
  return chunks.join("\r\n");
}

function buildMimeMessage(options: SmtpMailOptions): string {
  const mixedBoundary = `----=_Part_Mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const altBoundary = `----=_Part_Alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const msgId = `<${crypto.randomUUID()}@${(options.from.split("@")[1] || "facturier.local").replace(/[^a-zA-Z0-9.-]/g, "")}>`;

  const headers: string[] = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${options.from}`,
    `To: ${options.to}`,
    ...(options.cc ? [`Cc: ${options.cc}`] : []),
    `Subject: ${encodeMimeHeader(options.subject)}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];

  const textB64 = chunkBase64(Buffer.from(options.text || "", "utf8").toString("base64"));
  const htmlB64 = options.html
    ? chunkBase64(Buffer.from(options.html, "utf8").toString("base64"))
    : null;

  const bodyParts: string[] = [];

  bodyParts.push(`--${mixedBoundary}`);
  bodyParts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  bodyParts.push("");

  // Plain text part
  bodyParts.push(`--${altBoundary}`);
  bodyParts.push(`Content-Type: text/plain; charset=UTF-8`);
  bodyParts.push(`Content-Transfer-Encoding: base64`);
  bodyParts.push("");
  bodyParts.push(textB64);

  // HTML part
  if (htmlB64) {
    bodyParts.push(`--${altBoundary}`);
    bodyParts.push(`Content-Type: text/html; charset=UTF-8`);
    bodyParts.push(`Content-Transfer-Encoding: base64`);
    bodyParts.push("");
    bodyParts.push(htmlB64);
  }

  bodyParts.push(`--${altBoundary}--`);

  // Attachments
  if (options.attachments && options.attachments.length > 0) {
    for (const att of options.attachments) {
      const safeName = (att.filename || "document.pdf").replace(/["\r\n]/g, "_");
      const contentType = att.contentType || "application/pdf";
      const contentB64 = chunkBase64(att.content.toString("base64"));

      bodyParts.push(`--${mixedBoundary}`);
      bodyParts.push(`Content-Type: ${contentType}; name="${safeName}"`);
      bodyParts.push(`Content-Disposition: attachment; filename="${safeName}"`);
      bodyParts.push(`Content-Transfer-Encoding: base64`);
      bodyParts.push("");
      bodyParts.push(contentB64);
    }
  }

  bodyParts.push(`--${mixedBoundary}--`);
  bodyParts.push("");

  return headers.join("\r\n") + "\r\n\r\n" + bodyParts.join("\r\n");
}

/**
 * Exécute une session SMTP minimale (compatible SSL/TLS direct port 465 et STARTTLS port 587)
 * ou délègue à `nodemailer` s'il est installé dans l'environnement.
 */
async function runNativeSmtpSession(
  config: SmtpTransportConfig,
  mailOptions?: SmtpMailOptions
): Promise<{ verified: boolean; messageId?: string }> {
  // Essayer d'utiliser nodemailer s'il est présent dans node_modules
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dynamicRequire = eval("require");
    const nodemailer = dynamicRequire("nodemailer");
    if (nodemailer && typeof nodemailer.createTransport === "function") {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
      if (!mailOptions) {
        await transporter.verify();
        return { verified: true };
      }
      const info = await transporter.sendMail({
        from: mailOptions.from,
        to: mailOptions.to,
        cc: mailOptions.cc || undefined,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html || undefined,
        attachments: mailOptions.attachments,
      });
      return { verified: true, messageId: info?.messageId || `smtp-${Date.now()}` };
    }
  } catch {
    // Fallback transparent vers le client SMTP Node.js natif (net/tls)
  }

  return new Promise((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket;
    let buffer = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket?.destroy();
        reject(new Error("Délai d'attente SMTP dépassé (15s). Vérifiez l'hôte et le port."));
      }
    }, 15000);

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket?.destroy();
      } catch {}
      reject(err);
    };

    const succeed = (res: { verified: boolean; messageId?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket?.end();
      } catch {}
      resolve(res);
    };

    let waitResolve: ((line: { code: number; text: string }) => void) | null = null;

    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line) continue;
        // Une réponse finale SMTP a un espace après les 3 chiffres (ex: "250 OK", contre "250-PIPELINING")
        if (/^\d{3} /.test(line)) {
          const code = parseInt(line.slice(0, 3), 10);
          if (waitResolve) {
            const cb = waitResolve;
            waitResolve = null;
            cb({ code, text: line });
          }
        }
      }
    };

    const readResponse = (): Promise<{ code: number; text: string }> =>
      new Promise((res) => {
        waitResolve = res;
      });

    const sendCommand = async (cmd: string, expectedCodes: number[]) => {
      socket.write(cmd + "\r\n");
      const resp = await readResponse();
      if (!expectedCodes.includes(resp.code)) {
        throw new Error(`Erreur SMTP (${resp.code}) : ${resp.text}`);
      }
      return resp;
    };

    const runProtocol = async () => {
      try {
        const greeting = await readResponse();
        if (greeting.code !== 220) {
          throw new Error(`Serveur SMTP indisponible : ${greeting.text}`);
        }

        await sendCommand(`EHLO facturier.local`, [250]);

        // Upgrade STARTTLS si port non-SSL direct (ex: 587)
        if (!config.secure && config.port !== 465) {
          try {
            await sendCommand(`STARTTLS`, [220]);
            socket.removeAllListeners("data");
            socket = await new Promise<tls.TLSSocket>((tlsRes, tlsRej) => {
              const tlsSock = tls.connect(
                {
                  socket,
                  servername: config.host,
                  rejectUnauthorized: false,
                },
                () => tlsRes(tlsSock)
              );
              tlsSock.on("error", tlsRej);
            });
            socket.on("data", onData);
            socket.on("error", fail);
            await sendCommand(`EHLO facturier.local`, [250]);
          } catch {
            // Si le serveur ne requiert pas STARTTLS, continuer
          }
        }

        // Authentification AUTH LOGIN
        await sendCommand(`AUTH LOGIN`, [334]);
        await sendCommand(Buffer.from(config.user, "utf8").toString("base64"), [334]);
        await sendCommand(Buffer.from(config.pass, "utf8").toString("base64"), [235]);

        if (!mailOptions) {
          await sendCommand(`QUIT`, [221, 250]);
          succeed({ verified: true });
          return;
        }

        const extractEmail = (addr: string) => {
          const m = addr.match(/<([^>]+)>/);
          return m ? m[1] : addr.trim();
        };

        await sendCommand(`MAIL FROM:<${extractEmail(mailOptions.from)}>`, [250]);
        await sendCommand(`RCPT TO:<${extractEmail(mailOptions.to)}>`, [250, 251]);
        if (mailOptions.cc && mailOptions.cc.trim()) {
          await sendCommand(`RCPT TO:<${extractEmail(mailOptions.cc)}>`, [250, 251]);
        }

        await sendCommand(`DATA`, [354]);
        const rawMime = buildMimeMessage(mailOptions).replace(/\r\n\./g, "\r\n..");
        await sendCommand(`${rawMime}\r\n.`, [250]);
        await sendCommand(`QUIT`, [221, 250]);

        succeed({ verified: true, messageId: `smtp-${Date.now()}` });
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    };

    try {
      if (config.secure || config.port === 465) {
        socket = tls.connect({
          host: config.host,
          port: config.port,
          servername: config.host,
          rejectUnauthorized: false,
        });
      } else {
        socket = net.connect({
          host: config.host,
          port: config.port,
        });
      }

      socket.on("data", onData);
      socket.on("error", (err) => fail(err));
      runProtocol();
    } catch (err) {
      fail(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export async function verifySmtpConnection(config: SmtpTransportConfig): Promise<{ verified: boolean }> {
  return runNativeSmtpSession(config);
}

export async function sendSmtpMail(
  config: SmtpTransportConfig,
  options: SmtpMailOptions
): Promise<{ messageId: string }> {
  const res = await runNativeSmtpSession(config, options);
  return { messageId: res.messageId || `smtp-${Date.now()}` };
}

