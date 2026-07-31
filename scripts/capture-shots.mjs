import { chromium } from "playwright";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const outDir = join(appRoot, "assets", "shots");
const siteDir = join(appRoot, "..", "site", "public", "shots");

const SHOTS = [
  "dropzone",
  "unlock",
  "unlock-batch",
  "processing",
  "processing-batch",
  "success",
  "preview",
  "export",
  "sheets",
  "csv",
  "webhook",
  "saved",
];
const THEMES = ["light", "dark"];

function viewportFor(shot) {
  if (shot === "sheets" || shot === "webhook") return { width: 720, height: 960 };
  if (shot === "export" || shot === "csv") return { width: 720, height: 920 };
  if (shot === "preview") return { width: 720, height: 860 };
  return { width: 720, height: 680 };
}

async function waitForUrl(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(siteDir, { recursive: true });

  let viteProc = null;
  const base = "http://localhost:1420";
  try {
    await fetch(base);
  } catch {
    viteProc = spawn(
      "pnpm",
      ["dev", "--", "--host", "127.0.0.1", "--port", "1420"],
      { cwd: appRoot, stdio: "pipe", shell: true }
    );
    await waitForUrl(base);
  }

  const browser = await chromium.launch({ headless: true });
  const manifest = [];

  try {
    for (const theme of THEMES) {
      for (const shot of SHOTS) {
        const page = await browser.newPage({
          viewport: viewportFor(shot),
          deviceScaleFactor: 2,
        });
        await page.addInitScript((t) => {
          localStorage.setItem("theme", t);
          const style = document.createElement("style");
          style.textContent = `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
            }
          `;
          document.documentElement.appendChild(style);
        }, theme);

        const url = `${base}/?shot=${shot}&theme=${theme}`;
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForSelector("[data-shot-frame]", { timeout: 15000 });
        await page.waitForTimeout(450);

        const frame = page.locator("[data-shot-frame]");
        const file = `${shot}-${theme}.png`;
        const dest = join(outDir, file);
        await frame.screenshot({ path: dest, type: "png" });
        await copyFile(dest, join(siteDir, file));
        manifest.push({ shot, theme, file });
        console.log(`✓ ${file}`);
        await page.close();
      }
    }

    await copyFile(
      join(outDir, "success-light.png"),
      join(appRoot, "..", "site", "public", "app-image.png")
    );
    await copyFile(
      join(outDir, "success-dark.png"),
      join(appRoot, "..", "site", "public", "app-image-dark.png")
    );

    await writeFile(
      join(siteDir, "manifest.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), shots: manifest }, null, 2)
    );
    console.log(`✓ ${manifest.length} shots → site/public/shots/`);
    console.log("✓ Updated site hero app-image.png / app-image-dark.png");
  } finally {
    await browser.close();
    if (viteProc) viteProc.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
