const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user, pass },
  });
}

async function sendPasswordResetEmail(to, resetLink) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('[DEV] Password reset link (configure EMAIL_USER + EMAIL_PASS to send mail):');
    console.log(resetLink);
    return { sent: false, devLink: resetLink };
  }

  const mailOptions = {
    from: `"AllowanceAI" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset your AllowanceAI password',
    html: `
      <p>You requested a password reset for AllowanceAI.</p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
    text: `Reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Reset email sent to', to);
    return { sent: true };
  } catch (err) {
    console.error('MAIL ERROR:', err);
    throw err;
  }
}

module.exports = { sendPasswordResetEmail, createTransporter };
