import crypto from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const scryptAsync = promisify(crypto.scrypt);
const BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_DIR = path.resolve("docs/perf-phase2");
const mode = process.argv[2] || "before";

function parseEnvFile(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index);
        const value = line.slice(index + 1).replace(/^"|"$/g, "");
        return [key, value];
      }),
  );
}

const envSource = await fs.readFile(path.resolve(".env.local"), "utf8");
const env = { ...process.env, ...parseEnvFile(envSource) };

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@persevex-profiler.local`;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }
  if (!response.ok) {
    throw new Error(`${pathname} failed ${response.status}: ${typeof body === "object" && body && body.error ? body.error : text}`);
  }
  return body;
}

function pngDataUrl() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9lRsAAAAASUVORK5CYII=";
}

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfBase64(lines) {
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    ...lines.flatMap((line, index) => (index === 0 ? [`(${escapePdfText(line)}) Tj`] : ["0 -18 Td", `(${escapePdfText(line)}) Tj`])),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8").toString("base64");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

async function ensureAdminUser(email, password) {
  const { data: existing, error } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (error) throw error;

  const userId = existing?.id || crypto.randomUUID();
  if (!existing) {
    const { error: insertError } = await supabase.from("users").insert({
      id: userId,
      name: "Profiler Admin",
      email,
      role: "admin",
      status: "active",
      created_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: await hashPassword(password), role: "admin", status: "active" })
    .eq("id", userId);
  if (updateError) throw updateError;
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("networkidle");
}

async function collectMetrics(page, screenshotName, interactionFn) {
  await page.evaluate(() => {
    window.__PVX_PERF__?.reset();
    window.__PVX_PERF__?.mark("start");
  });
  await interactionFn();
  await page.waitForTimeout(800);
  const metrics = await page.evaluate(() => ({
    snapshot: window.__PVX_PERF__?.getSnapshot?.() || {},
    marks: window.__PVX_PERF__?.getMarks?.() || [],
  }));
  await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName), fullPage: true });
  return metrics;
}

async function seedScenario() {
  const password = "ProfilerPass123";
  const candidateEmail = uniqueEmail("candidate");
  const recruiterEmail = uniqueEmail("recruiter");
  const adminEmail = uniqueEmail("admin");

  const candidateRegister = await api("/api/auth/register", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: "Profiler Candidate", email: candidateEmail, password, role: "candidate" }),
  });

  const recruiterRegister = await api("/api/auth/register", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: "Profiler Recruiter", email: recruiterEmail, password, role: "company" }),
  });

  await ensureAdminUser(adminEmail, password);
  const adminLogin = await api("/api/auth/login", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email: adminEmail, password }),
  });

  const candidateToken = candidateRegister.token;
  const recruiterToken = recruiterRegister.token;
  const adminToken = adminLogin.token;
  const candidateId = candidateRegister.user.id;
  const recruiterId = recruiterRegister.user.id;

  await api("/api/candidates/profile/photo", {
    method: "POST",
    headers: authHeaders(candidateToken),
    body: JSON.stringify({ base64: pngDataUrl(), fileName: "profiler-avatar.png", mimeType: "image/png" }),
  });

  await api("/api/parser/pdf", {
    method: "POST",
    headers: authHeaders(candidateToken),
    body: JSON.stringify({
      base64: createPdfBase64([
        "PROFILER CANDIDATE",
        candidateEmail,
        "Skills: React, TypeScript, Node.js",
        "Education: B.Tech Computer Science",
        "Experience: Internship building dashboards",
      ]),
      fileName: "profiler-resume.pdf",
    }),
  });

  await api("/api/candidates/profile/update", {
    method: "POST",
    headers: authHeaders(candidateToken),
    body: JSON.stringify({
      education: "B.Tech Computer Science",
      experience: "Frontend internship building dashboards and admin tools",
      skills: ["React", "TypeScript", "Node.js", "SQL"],
      preferredSkills: ["Performance", "UI"],
      resumeText: "React TypeScript Node.js SQL performance optimization resume",
      resumeFileName: "profiler-resume.pdf",
    }),
  });

  await api("/api/companies/update", {
    method: "POST",
    headers: authHeaders(recruiterToken),
    body: JSON.stringify({
      companyName: "Profiler Recruiter Labs",
      website: "https://profiler.example.com",
      linkedin: "https://linkedin.com/company/profiler-recruiter-labs",
      industry: "Technology",
      companyEmail: recruiterEmail,
      contactPerson: "Profiler Recruiter",
      phone: "+1 555-0101",
    }),
  });

  await api("/api/companies/documents", {
    method: "POST",
    headers: authHeaders(recruiterToken),
    body: JSON.stringify({
      base64: createPdfBase64(["PROFILER COMPANY", recruiterEmail]),
      fileName: "profiler-company.pdf",
      mimeType: "application/pdf",
    }),
  });

  const adminCompanies = await api("/api/companies", { headers: authHeaders(adminToken) });
  const targetCompany = adminCompanies.companies.find((company) => company.userId === recruiterId);
  await api(`/api/companies/${targetCompany.id}/status`, {
    method: "POST",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ status: "approved" }),
  });

  const jobCreate = await api("/api/jobs/create", {
    method: "POST",
    headers: authHeaders(recruiterToken),
    body: JSON.stringify({
      title: "Profiler Frontend Engineer",
      department: "Engineering",
      location: "Remote",
      jobType: "Full-time",
      experience: "0-2 years",
      salary: "12-18 LPA",
      description: "Build fast React workflows and optimize runtime interactions.",
      requirements: ["React", "TypeScript", "Node.js", "SQL"],
      preferredSkills: ["Performance", "Accessibility"],
      deadline: "2026-12-31",
    }),
  });

  await api(`/api/jobs/${jobCreate.job.id}/status`, {
    method: "POST",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ status: "approved" }),
  });

  await api("/api/applications/apply", {
    method: "POST",
    headers: authHeaders(candidateToken),
    body: JSON.stringify({
      jobId: jobCreate.job.id,
      resumeText: "React TypeScript Node.js SQL performance optimization resume",
      resumeFileName: "profiler-resume.pdf",
    }),
  });

  const adminApplications = await api("/api/applications", { headers: authHeaders(adminToken) });
  const candidateApp = adminApplications.applications.find(
    (application) => application.jobId === jobCreate.job.id && application.candidateId === candidateId,
  );
  await api(`/api/applications/${candidateApp.id}/status`, {
    method: "POST",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ status: "forwarded" }),
  });

  return {
    password,
    candidateEmail,
    recruiterEmail,
    adminEmail,
    candidateId,
    recruiterId,
    jobId: jobCreate.job.id,
  };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const accounts = await seedScenario();
  await fs.writeFile(path.join(OUTPUT_DIR, `accounts-${mode}.json`), JSON.stringify(accounts, null, 2));
  if (mode === "seed") {
    console.log(JSON.stringify({ mode, accounts }, null, 2));
    return;
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const results = {};

  try {
    const candidateContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const candidatePage = await candidateContext.newPage();
    await loginAs(candidatePage, accounts.candidateEmail, accounts.password);
    await candidatePage.evaluate((userId) => {
      localStorage.setItem(`persevex_pref_${userId}`, "Frontend Engineer");
    }, accounts.candidateId);
    await candidatePage.reload({ waitUntil: "networkidle" });
    await candidatePage.waitForSelector(".eff-header");
    results.candidate = await collectMetrics(candidatePage, `candidate-${mode}.png`, async () => {
      await candidatePage.getByRole("button", { name: /switch to dark mode|switch to light mode/i }).click();
      await candidatePage.getByPlaceholder(/search title, company, skill, or keyword/i).fill("react");
      await candidatePage.waitForTimeout(300);
      const detailsButtons = candidatePage.getByRole("button", { name: /view details/i });
      if (await detailsButtons.count()) {
        await detailsButtons.first().click();
        await candidatePage.waitForTimeout(250);
        await candidatePage.getByRole("button", { name: /close job details/i }).click();
      }
      await candidatePage.getByRole("button", { name: "Applications" }).click();
      await candidatePage.waitForTimeout(250);
      const trackerButton = candidatePage.locator(".eff-application-list article button").first();
      if (await trackerButton.count()) {
        await trackerButton.click();
        await candidatePage.waitForTimeout(250);
      }
    });
    await candidateContext.close();

    const recruiterContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const recruiterPage = await recruiterContext.newPage();
    await loginAs(recruiterPage, accounts.recruiterEmail, accounts.password);
    await recruiterPage.waitForSelector(".rec-tabs");
    results.recruiter = await collectMetrics(recruiterPage, `recruiter-${mode}.png`, async () => {
      await recruiterPage.getByRole("button", { name: "Manage Jobs" }).click();
      await recruiterPage.waitForTimeout(250);
      await recruiterPage.getByPlaceholder(/Search jobs, location, or skill/i).fill("frontend");
      await recruiterPage.waitForTimeout(250);
      await recruiterPage.getByRole("button", { name: "Applicants" }).click();
      await recruiterPage.waitForTimeout(350);
      const reviewButtons = recruiterPage.getByRole("button", { name: "Review" });
      if (await reviewButtons.count()) {
        await reviewButtons.first().click();
        await recruiterPage.waitForTimeout(350);
        await recruiterPage.getByRole("button", { name: /close candidate review/i }).click();
      }
      await recruiterPage.getByRole("button", { name: "Analytics" }).click();
      await recruiterPage.waitForTimeout(250);
    });
    await recruiterContext.close();

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, accounts.adminEmail, accounts.password);
    await adminPage.waitForSelector(".platform-page");
    results.admin = await collectMetrics(adminPage, `admin-${mode}.png`, async () => {
      await adminPage.getByRole("button", { name: /jobs & moderation/i }).click();
      await adminPage.waitForTimeout(250);
      await adminPage.getByPlaceholder(/title, company, skill/i).fill("frontend");
      await adminPage.waitForTimeout(250);
      await adminPage.getByRole("button", { name: /screening desk/i }).click();
      await adminPage.waitForTimeout(350);
    });
    await adminContext.close();
  } finally {
    await browser.close();
  }

  const payload = { phase: mode, accounts, results };
  await fs.writeFile(path.join(OUTPUT_DIR, `metrics-${mode}.json`), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
