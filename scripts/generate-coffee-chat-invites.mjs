#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import schedule from "../data/sponsorCoffeeChatWindows.json" with { type: "json" };

const [inputPath, baseUrl, ...rest] = process.argv.slice(2);
const linksOutIndex = rest.indexOf("--links-out");
const linksOutPath = linksOutIndex >= 0 ? rest[linksOutIndex + 1] : null;
const expiresAt =
  process.env.COFFEE_CHAT_INVITE_EXPIRES_AT || schedule.inviteExpiresAt || null;

if (!inputPath || !baseUrl) {
  console.error("Usage: node scripts/generate-coffee-chat-invites.mjs shortlist.csv https://example.com --links-out invite-links.csv");
  console.error("CSV columns: student_name,student_email,sponsor");
  process.exit(1);
}

const sponsorByName = new Map(
  schedule.sponsors.flatMap((sponsor) => [
    [sponsor.name.toLowerCase(), sponsor],
    [sponsor.slug.toLowerCase(), sponsor],
    ...(sponsor.aliases ?? []).map((alias) => [alias.toLowerCase(), sponsor]),
  ])
);

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sql(value) {
  return String(value).replaceAll("'", "''");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getColumn(row, header, candidates) {
  for (const candidate of candidates) {
    const index = header.indexOf(candidate);
    if (index >= 0) return row[index]?.trim() ?? "";
  }
  return "";
}

const rows = parseCsv(fs.readFileSync(inputPath, "utf8"));
const header = rows
  .shift()
  ?.map((column) => column.trim().toLowerCase().replace(/\s+/g, "_"));

if (!header) {
  console.error("CSV is empty.");
  process.exit(1);
}

const students = new Map();

for (const row of rows) {
  const fullName = getColumn(row, header, ["student_name", "name", "full_name"]);
  const email = getColumn(row, header, ["student_email", "email"]);
  const sponsorName = getColumn(row, header, ["sponsor", "company", "sponsor_name"]);

  if (!fullName || !email || !sponsorName) {
    console.error(`Missing name/email/sponsor in row: ${JSON.stringify(row)}`);
    process.exit(1);
  }

  const sponsor = sponsorByName.get(sponsorName.toLowerCase());
  if (!sponsor) {
    console.error(`Unknown sponsor "${sponsorName}". Update data/sponsorCoffeeChatWindows.json first.`);
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = students.get(normalizedEmail) ?? {
    fullName,
    email,
    sponsors: new Map(),
    token: crypto.randomBytes(24).toString("base64url"),
  };

  existing.sponsors.set(sponsor.slug, sponsor.name);
  students.set(normalizedEmail, existing);
}

const links = [["student_name", "student_email", "sponsors", "invite_url"]];

console.log("-- Generated coffee-chat student invites and sponsor shortlists");
console.log("-- Token hashes are stored in Supabase. Raw invite links are only emitted to the links CSV.");
console.log("");
console.log("BEGIN;");
console.log("");

for (const student of students.values()) {
  const tokenHash = hashToken(student.token);
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/coffee-chats/${student.token}`;
  const sponsorNames = [...student.sponsors.values()].join("; ");
  links.push([student.fullName, student.email, sponsorNames, inviteUrl]);

  console.log("INSERT INTO public.coffee_chat_students (full_name, email)");
  console.log(`VALUES ('${sql(student.fullName)}', '${sql(student.email)}')`);
  console.log("ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name;");
  console.log("");

  console.log("INSERT INTO public.coffee_chat_invites (student_id, token_hash, expires_at)");
  console.log("SELECT id,");
  console.log(`  '${tokenHash}',`);
  console.log(`  ${expiresAt ? `'${sql(expiresAt)}'::timestamptz` : "NULL"}`);
  console.log("FROM public.coffee_chat_students");
  console.log(`WHERE lower(email::text) = lower('${sql(student.email)}')`);
  console.log("ON CONFLICT (token_hash) DO NOTHING;");
  console.log("");

  for (const sponsorSlug of student.sponsors.keys()) {
    console.log("INSERT INTO public.coffee_chat_shortlists (student_id, sponsor_id, status)");
    console.log("SELECT st.id, sp.id, 'invited'");
    console.log("FROM public.coffee_chat_students st");
    console.log(`JOIN public.coffee_chat_sponsors sp ON sp.slug = '${sql(sponsorSlug)}'`);
    console.log(`WHERE lower(st.email::text) = lower('${sql(student.email)}')`);
    console.log("ON CONFLICT (student_id, sponsor_id)");
    console.log("DO UPDATE SET status = 'invited';");
    console.log("");
  }
}

console.log("COMMIT;");

if (linksOutPath) {
  fs.writeFileSync(
    linksOutPath,
    `${links.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`
  );
  console.error(`Wrote invite links to ${linksOutPath}`);
} else {
  console.error("");
  console.error("Invite links:");
  console.error(links.map((row) => row.map(csvEscape).join(",")).join("\n"));
}
