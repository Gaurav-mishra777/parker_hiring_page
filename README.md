# Parker Hiring Page Deployment

## 1) Install dependencies

```bash
npm install
```

## 2) Configure email

Create `.env` from `.env.example` and set real values:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `HR_EMAIL`

For Gmail SMTP:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- Use an App Password in `SMTP_PASS`.

## 3) Run locally

```bash
npm start
```

Open: `http://localhost:3000`

## 4) Deploy on Render (recommended)

1. Push this project to GitHub.
2. In Render, create a **Web Service** from the repo.
3. Use settings:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add all `.env` values in Render Environment Variables.
5. Deploy.

After deploy, your form will submit to `/api/apply`, and HR will receive an email with resume attachment.