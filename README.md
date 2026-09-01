# Hack the North Coffee Chats

Booking app for Hack the North sponsor coffee chats.

The app opens on the coffee chat invite-required page by default. Hackers book
through private `/coffee-chats/[token]` links.

Coffee chat confirmation emails use EmailJS. Create a service and a coffee chat
template in EmailJS, then set:

- `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`
- `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
- `NEXT_PUBLIC_EMAILJS_COFFEE_CHAT_TEMPLATE_ID`

The template should send to `{{to_email}}` and can use:

- `{{to_name}}`
- `{{student_name}}`
- `{{sponsor_name}}`
- `{{chat_date}}`
- `{{chat_time}}`
- `{{chat_room}}`
- `{{booking_url}}`
- `{{event_name}}`

## Quick start

```bash
cd next-app
cp .env.local.example .env.local
# send me a dm for the keys if you need them or sign in to the admin supabase account
npm install
npm run dev
```

## Contact

Questions: **microgrants@hackthenorth.com** or **arya@hackthenorth.com**
