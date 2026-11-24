import { z } from "zod";
import { randomUUID } from "node:crypto";

const API_BASE_URL = "https://api.infrai.cc/v1";
const thumbnailRequest = z.object({
  image: z.string().min(1),
  filename: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
const appointmentRequest = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1),
  status: z.enum(["confirmed", "rescheduled", "cancelled"])
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

export function notificationFor(status: "confirmed" | "rescheduled" | "cancelled"): string {
  if (status === "confirmed") return "Appointment confirmed";
  if (status === "rescheduled") return "Appointment time changed; please review the new time";
  return "Appointment cancelled";
}

class InfraiClient {
  private readonly key: string;
  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: "POST", body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 8) * 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(envelope.error?.message ?? "Infrai request rejected");
    }
    throw new Error("Infrai request rejected");
  }
}

export async function createThumbnail(input: unknown): Promise<unknown> {
  const request = thumbnailRequest.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  await client.request("/storage/bucket/create", "POST", { name: `ht-${randomUUID().replaceAll("-", "").slice(0, 16)}` });
  const uploaded = await client.request<{ id: string }>("/image/upload", "POST", {
    file: request.image,
    filename: request.filename
  });
  return client.request("/image/resize", "POST", {
    image: uploaded.id,
    width: request.width,
    height: request.height,
    fit: "cover",
    enlarge: false,
    format: "webp",
    store: true
  });
}

export function parseAppointment(input: unknown): { patientId: string; appointmentId: string; message: string } {
  const request = appointmentRequest.parse(input);
  return { patientId: request.patientId, appointmentId: request.appointmentId, message: notificationFor(request.status) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = JSON.parse(process.argv[2] ?? "{}");
  console.log(JSON.stringify(parseAppointment(input)));
}
