const express    = require("express");
const nodemailer = require("nodemailer");
const cors       = require("cors");

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "pickupapp.noreply@gmail.com",
    pass: "lwvljfhcphwswfbk",
  },
});

const codes = {};

app.post("/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const code   = Math.floor(100000 + Math.random() * 900000).toString();
  codes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };

  try {
    await transporter.sendMail({
      from:    '"PickUp" <pickupapp.noreply@gmail.com>',
      to:      email,
      subject: "Your PickUp verification code",
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 4px">
            <span style="color:#1D9E75">Pick</span><span style="color:#111">Up</span>
          </h2>
          <p style="color:#666;margin:0 0 24px;font-size:14px">Find your next game.</p>
          <p style="color:#333;margin-bottom:20px">
            Here's your verification code to create your PickUp account:
          </p>
          <div style="background:#f5f5f3;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
            <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#111">${code}</span>
          </div>
          <p style="color:#888;font-size:13px;margin-bottom:4px">This code expires in 10 minutes.</p>
          <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    console.log(`Code sent to ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Gmail error:", err.message);
    res.status(500).json({ error: "Failed to send email", detail: err.message });
  }
});

app.post("/verify-code", (req, res) => {
  const { email, code } = req.body;
  const entry = codes[email];

  if (!entry)                     return res.json({ valid: false, reason: "No code found" });
  if (Date.now() > entry.expires) return res.json({ valid: false, reason: "Code expired" });
  if (entry.code !== code)        return res.json({ valid: false, reason: "Wrong code" });

  delete codes[email];
  res.json({ valid: true });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(8001, () => console.log("Email API running on http://localhost:8001"));
