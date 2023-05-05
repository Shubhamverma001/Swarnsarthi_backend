const nodemailer = require('nodemailer');
const config = require('config.json');

module.exports = sendEmail;

async function sendEmail({ to, subject, html, from = config.emailFrom }) {
    //let testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
        service:"gmail",
        auth: {
          user: "falgunisharma231@gmail.com", // generated ethereal user
          pass: "vwiuhdbiajtrhffn", // generated ethereal password
        },
      });
    await transporter.sendMail({ from:"falgunisharma231@gmail.com", to, subject, html });
    console.log("verification email sent");
}