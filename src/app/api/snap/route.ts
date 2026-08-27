import { writeFile } from "fs/promises";
import path from "path";

/**
 * DEV-ONLY debug endpoint. Accepts a canvas data URL and writes it to disk so
 * the rendered WebGL frame can be inspected outside the browser. Disabled in
 * production builds; delete this route once the 3D work is signed off.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("disabled", { status: 404 });
  }

  const { dataUrl, name } = await req.json();

  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
    return new Response("expected a png data url", { status: 400 });
  }

  // Keep the filename to a safe slug — this writes to disk.
  const safe = String(name ?? "snap").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "snap";
  const dir = process.env.SNAP_DIR || path.join(process.cwd(), ".snaps");

  const { mkdir } = await import("fs/promises");
  await mkdir(dir, { recursive: true });

  const file = path.join(dir, `${safe}.png`);
  await writeFile(file, Buffer.from(dataUrl.slice(22), "base64"));

  return Response.json({ ok: true, file });
}
