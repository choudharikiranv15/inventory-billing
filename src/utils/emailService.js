import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendEmail = async ({ to, subject, text, html, attachments }) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email service not configured. Skipping email send.');
      return;
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendInvoice = async (to, invoiceNumber, pdfBuffer) => {
  const subject = `Invoice #${invoiceNumber}`;
  const text = `Please find attached your invoice #${invoiceNumber}. Thank you for your business!`;
  const html = `
    <h1>Invoice #${invoiceNumber}</h1>
    <p>Please find attached your invoice.</p>
    <p>Thank you for your business!</p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    attachments: [{
      filename: `Invoice-${invoiceNumber}.pdf`,
      content: pdfBuffer
    }]
  });
}; 