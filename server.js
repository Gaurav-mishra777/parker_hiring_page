const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]);

    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error('Only PDF, DOC, DOCX, or TXT files are allowed.'));
    }

    cb(null, true);
  }
});

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  if (!host || !user || !pass) {
    throw new Error('Missing SMTP config. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host,
    port: smtpPort,
    secure,
    auth: { user, pass }
  });
}

app.post('/api/apply', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required.' });
    }

    const {
      name,
      email,
      phone = '',
      current_location = '',
      position,
      experience,
      current_ctc = '',
      expected_ctc = '',
      message = '',
      submitted_at = new Date().toISOString()
    } = req.body;

    if (!name || !email || !position || !experience) {
      return res.status(400).json({ error: 'Missing required form fields.' });
    }

    const hrEmail = process.env.HR_EMAIL;
    const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

    if (!hrEmail) {
      return res.status(500).json({ error: 'HR_EMAIL is not configured on server.' });
    }

    const transporter = getTransporter();

    const subject = `New Job Application: ${position}`;
    const textBody = [
      'New job application received.',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Current Location: ${current_location}`,
      `Position: ${position}`,
      `Experience: ${experience}`,
      `Current CTC: ${current_ctc}`,
      `Expected CTC: ${expected_ctc}`,
      '',
      'Message:',
      message || '-',
      '',
      `Submitted at: ${new Date(submitted_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`
    ].join('\n');

    await transporter.sendMail({
      from: mailFrom,
      to: hrEmail,
      replyTo: email,
      subject,
      text: textBody,
      attachments: [
        {
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: req.file.mimetype
        }
      ]
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error && error.message ? error.message : 'Internal server error';
    console.error('Failed to send application email:', error);
    return res.status(500).json({ error: message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});