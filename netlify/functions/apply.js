const nodemailer = require('nodemailer');
const Busboy = require('busboy');

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function getHeader(headers, key) {
  if (!headers) return '';
  return headers[key] || headers[key.toLowerCase()] || '';
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = getHeader(event.headers, 'content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    const fields = {};
    const files = {};

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 10 * 1024 * 1024 }
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('limit', () => {
        reject(new Error('Resume file is too large (max 10MB).'));
      });

      file.on('end', () => {
        files[name] = {
          filename,
          mimetype: mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, files }));

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf8');

    busboy.end(rawBody);
  });
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Missing SMTP config. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseMultipart(event);
    const resume = files.resume;

    if (!resume) {
      return response(400, { error: 'Resume file is required.' });
    }

    if (!ALLOWED_TYPES.has(resume.mimetype)) {
      return response(400, { error: 'Only PDF, DOC, DOCX, or TXT files are allowed.' });
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
    } = fields;

    if (!name || !email || !position || !experience) {
      return response(400, { error: 'Missing required form fields.' });
    }

    const hrEmail = process.env.HR_EMAIL;
    const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

    if (!hrEmail) {
      return response(500, { error: 'HR_EMAIL is not configured on server.' });
    }

    const transporter = createTransporter();

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
      subject: `New Job Application: ${position}`,
      text: textBody,
      attachments: [
        {
          filename: resume.filename || 'resume',
          content: resume.buffer,
          contentType: resume.mimetype
        }
      ]
    });

    return response(200, { ok: true });
  } catch (error) {
    console.error('Netlify apply function failed:', error);
    return response(500, { error: error.message || 'Internal server error' });
  }
};