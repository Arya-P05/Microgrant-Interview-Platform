# Sponsor Coffee Chats

This is the safer replacement flow for sponsor coffee chats / interview slots.

## Access Model

- Students receive a unique `/coffee-chats/[token]` link.
- Supabase stores only the SHA-256 hash of each token.
- The token reveals only that student's shortlisted sponsors and available slots.
- The private token is the booking credential; no Supabase Auth verification is required.
- The database function enforces sponsor eligibility, one active booking per sponsor, and no overlapping bookings for the same student.
- Slot capacity comes from the sponsor-specific hackers-per-slot value.
- When a student selects a time, the page randomly picks one active room and shows only that assigned room in the confirm bar.
- Booking sends the selected room to Supabase; the database validates sponsor eligibility, total slot capacity, and per-room capacity before saving.
- Invite links expire at the end of Saturday, September 19, 2026 in Toronto time by default.
- Public table reads/writes stay closed through Row Level Security.

## Screenshot Schedule

The current sponsor windows are stored in `data/sponsorCoffeeChatWindows.json`.

- Date: Saturday, September 19, 2026
- Invite expiry: Sunday, September 20, 2026 at 12:00 a.m. Toronto time
- Timezone: America/Toronto
- Federato: 9:00-13:00, Room C (PSE 2342) and Room D (PSE 2344), 6 hackers per slot, 20-minute slots
- Dominion Dynamics: 9:00-13:00, Room E (PSE 2346), Room F (PSE 2348), and Room G (PSE 2352), 4 hackers per slot, 30-minute slots

Generate slot SQL:

```bash
node scripts/generate-coffee-chat-slots.mjs > coffee-chat-slots.sql
```

The script defaults to the date/timezone in `data/sponsorCoffeeChatWindows.json`.

## Student Shortlist Import

Expected CSV columns:

```csv
student_name,student_email,sponsor
Alex Hacker,alex@example.com,Federato
Alex Hacker,alex@example.com,Dominion Dynamics
Sam Student,sam@example.com,Federato
```

Use one row per student/sponsor shortlist. A student selected by two sponsors
gets two rows with the same `student_email` and different `sponsor` values.

Generate SQL and emailable links:

```bash
node scripts/generate-coffee-chat-invites.mjs shortlist.csv https://your-domain.com --links-out invite-links.csv > coffee-chat-invites.sql
```

Override the default expiry:

```bash
COFFEE_CHAT_INVITE_EXPIRES_AT=2026-09-20T03:00:00-04:00 node scripts/generate-coffee-chat-invites.mjs shortlist.csv https://your-domain.com --links-out invite-links.csv > coffee-chat-invites.sql
```

## Launch Checklist

- Confirm exact production domain for invite links.
- Confirm sponsor display names before import.
- Apply the Supabase migration.
- Generate and review slot SQL.
- Import sponsor slots.
- Import student shortlist and invite links.
- Send a test invite to a real inbox and complete the private-link booking flow.
- Send a test booking confirmation email.
- Export `coffee_chat_schedule_export` for sponsor reps before the event. The export includes sponsor, student, time, room, location block, booked time, and cancellation state.
- Use `scripts/export-coffee-chat-schedule.sql` for a clean active-bookings export.

## Email Sender

Use a transactional sender for invite and confirmation emails. Resend with a
verified Hack the North domain is the strongest production choice, but the
existing EmailJS setup can also send lightweight booking confirmation emails.
Supabase Auth emails are no longer needed for the coffee-chat booking flow.

The hosted Supabase Auth templates in the `interviews` project were previously
updated for a verification flow:

- Confirm sign up subject: `Confirm your Hack the North coffee chat invite`
- Magic link or OTP subject: `Continue to your Hack the North coffee chat invite`
- Both templates use Hack the North copy and a `Continue to booking` CTA that
  links through `{{ .ConfirmationURL }}`

Those templates are now fallback-only because booking no longer requires
Supabase Auth. The sender line remains Supabase-branded until custom SMTP is
enabled under Authentication -> Emails -> SMTP Settings.

## Local Preview

The demo route is available in development:

```txt
http://127.0.0.1:5173/coffee-chats/demo
```
