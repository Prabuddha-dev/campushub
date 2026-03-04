import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const db = new Database("campus.db");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// ==================== EMAIL TRANSPORTER SETUP ====================
let transporter: nodemailer.Transporter;
(async () => {
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log("📧 Configuring real SMTP with:", {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        secure: process.env.SMTP_SECURE === "true",
      });
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.verify();
      console.log("✅ SMTP connection verified – ready to send real emails");
    } else {
      console.log("📧 No SMTP settings found, using Ethereal test account");
      const testAccount = await nodemailer.createTestAccount();
      console.log("✅ Ethereal test account created:", testAccount.user);
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
  } catch (error) {
    console.error("❌ Failed to create email transporter:", error);
    transporter = {
      sendMail: async (options: any) => {
        console.log("📧 [FALLBACK] Email would be sent:", options);
        return { messageId: "dummy" };
      }
    } as any;
  }
})();

async function sendNoticeEmail(notice: any, action: 'created' | 'updated') {
  try {
    const students = db.prepare("SELECT email FROM users WHERE role = 'student'").all() as { email: string }[];
    const emails = students.map(s => s.email);
    if (emails.length === 0) {
      console.log("⚠️ No students to notify – skipping email");
      return;
    }
    const actionText = action === 'created' ? 'New Notice Posted' : 'Notice Updated';
    const fromEmail = process.env.SMTP_USER || 'noreply@campushub.edu';
    const mailOptions = {
      from: `"CampusHub" <${fromEmail}>`,
      to: emails.join(','),
      subject: `${actionText}: ${notice.title}`,
      html: `
        <h2>${actionText}</h2>
        <h3>${notice.title}</h3>
        <p><strong>Category:</strong> ${notice.category}</p>
        <p><strong>Department:</strong> ${notice.department || 'All'}</p>
        <p><strong>Branch:</strong> ${notice.branch || 'All'}</p>
        <p><strong>Year:</strong> ${notice.year || 'All'}</p>
        <hr>
        <p>${notice.content.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}">View on CampusHub</a></p>
      `,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent, messageId:", info.messageId);
    if (info.messageId && info.messageId !== 'dummy' && !process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("📧 Ethereal preview URL:", previewUrl);
    }
  } catch (error) {
    console.error("❌ Failed to send notice email:", error);
  }
}

// ==================== DATABASE INITIALIZATION ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT,
    branch TEXT,
    year TEXT,
    views INTEGER DEFAULT 0,
    date_posted DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT,
    location_lat REAL,
    location_lng REAL,
    location_name TEXT,
    photo_url TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    department TEXT,
    branch TEXT,
    year TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed FAQs if empty
const faqCount = db.prepare("SELECT COUNT(*) as count FROM faqs").get() as { count: number };
if (faqCount.count === 0) {
  const insertFaq = db.prepare("INSERT INTO faqs (question, answer) VALUES (?, ?)");
  insertFaq.run("When is the next semester starting?", "The next semester is scheduled to start on August 15th, 2026.");
  insertFaq.run("How to apply for a scholarship?", "You can apply through the student portal under the 'Scholarships' section before the end of September.");
  insertFaq.run("Where is the main library located?", "The main library is located in Block B, 3rd Floor.");
}

// Seed notices if empty
const noticeCount = db.prepare("SELECT COUNT(*) as count FROM notices").get() as { count: number };
if (noticeCount.count === 0) {
  const insertNotice = db.prepare("INSERT INTO notices (title, content, category, department, branch, year) VALUES (?, ?, ?, ?, ?, ?)");
  insertNotice.run("Mid-Term Examination Schedule", "The mid-term examinations for all engineering branches will commence from April 10th.", "Exam", "Engineering", "All", "All");
  insertNotice.run("Pharmacy Lab Safety Workshop", "Mandatory safety workshop for all B.Pharm students in the main auditorium.", "Event", "Pharmacy", "B.Pharm", "All");
  insertNotice.run("Diploma Project Submission", "Final year diploma students must submit their project reports by next Friday.", "Urgent", "Diploma", "Polytechnic", "3rd Year");
  insertNotice.run("Semester Fee Payment Deadline", "The last date for semester fee payment without fine is March 25th, 2026. Please pay via the student portal.", "Fee", "All", "All", "All");
}

// Seed issues if empty
const issueCount = db.prepare("SELECT COUNT(*) as count FROM issues").get() as { count: number };
if (issueCount.count === 0) {
  const insertIssue = db.prepare("INSERT INTO issues (student_email, title, description, category, location_name, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertIssue.run("gadheseenu@gmail.com", "Projector not working", "The projector in Room 402 is not turning on. We have a presentation tomorrow.", "IT/Projector", "Block A, Room 402", "Medium", "Pending");
  insertIssue.run("gadheseenu@gmail.com", "Leaking Tap in Washroom", "The tap in the 2nd floor men's washroom is leaking heavily.", "Plumbing", "Block B, 2nd Floor", "Low", "In Progress");
}

// Seed users (admin & student)
try {
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  if (adminCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)")
      .run('admin@campus.edu', hashedPassword, 'Admin User', 'admin');
  }

  const studentCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as { count: number };
  if (studentCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('student123', 10);
    db.prepare("INSERT INTO users (email, password, name, role, department, branch, year) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run('student@campus.edu', hashedPassword, 'Test Student', 'student', 'Engineering', 'Computer Science', '2nd Year');
  }
} catch (err) {
  console.error("Seeding users failed:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // ========== Auth Routes ==========
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, role, department, branch, year } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare(`
        INSERT INTO users (email, password, name, role, department, branch, year)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(email, hashedPassword, name, role || 'student', department, branch, year);
      res.json({ id: info.lastInsertRowid, message: 'User created successfully' });
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: 'Internal server error. Please try again.' });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const valid = bcrypt.compareSync(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      const { password: _, ...userWithoutPassword } = user;
      res.json({ token, user: userWithoutPassword });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No token' });
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET) as any;
      const user = db.prepare('SELECT id, email, name, role, department, branch, year FROM users WHERE id = ?').get(payload.id);
      if (!user) return res.status(401).json({ error: 'User not found' });
      res.json({ user });
    } catch (err) {
      console.error('Auth me error:', err);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // ========== Notice Routes ==========
  app.get("/api/notices", (req, res) => {
    try {
      const notices = db.prepare("SELECT * FROM notices ORDER BY date_posted DESC").all();
      res.json(notices);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch notices' });
    }
  });

  app.get("/api/notices/:id", (req, res) => {
    try {
      db.prepare("UPDATE notices SET views = views + 1 WHERE id = ?").run(req.params.id);
      const notice = db.prepare("SELECT * FROM notices WHERE id = ?").get(req.params.id);
      res.json(notice);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch notice' });
    }
  });

  app.post("/api/notices", (req, res) => {
    try {
      const { title, content, category, department, branch, year } = req.body;
      const info = db.prepare("INSERT INTO notices (title, content, category, department, branch, year) VALUES (?, ?, ?, ?, ?, ?)").run(title, content, category, department, branch, year);
      const newNotice = { id: info.lastInsertRowid, title, content, category, department, branch, year, date_posted: new Date().toISOString() };
      sendNoticeEmail(newNotice, 'created').catch(console.error);
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create notice' });
    }
  });

  app.put("/api/notices/:id", (req, res) => {
    try {
      const { title, content, category, department, branch, year } = req.body;
      const stmt = db.prepare(`
        UPDATE notices 
        SET title = ?, content = ?, category = ?, department = ?, branch = ?, year = ?
        WHERE id = ?
      `);
      const info = stmt.run(title, content, category, department, branch, year, req.params.id);
      if (info.changes === 0) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      const updated = db.prepare("SELECT * FROM notices WHERE id = ?").get(req.params.id);
      sendNoticeEmail(updated, 'updated').catch(console.error);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update notice' });
    }
  });

  app.delete("/api/notices/:id", (req, res) => {
    try {
      const stmt = db.prepare("DELETE FROM notices WHERE id = ?");
      const info = stmt.run(req.params.id);
      if (info.changes === 0) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete notice' });
    }
  });

  // ========== Issue Routes ==========
  app.get("/api/issues", (req, res) => {
    try {
      const issues = db.prepare("SELECT * FROM issues ORDER BY created_at DESC").all();
      res.json(issues);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch issues' });
    }
  });

  app.get("/api/issues/student/:email", (req, res) => {
    try {
      const issues = db.prepare("SELECT * FROM issues WHERE student_email = ? ORDER BY created_at DESC").all(req.params.email);
      res.json(issues);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch issues' });
    }
  });

  // POST with file upload
  app.post("/api/issues", upload.single('photo'), (req, res) => {
    try {
      const { student_email, title, description, category, department, location_lat, location_lng, location_name, priority } = req.body;
      const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

      // Validate required fields
      if (!student_email || !title || !description || !category || !department || !location_name || !priority) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const info = db.prepare(`
        INSERT INTO issues 
        (student_email, title, description, category, department, location_lat, location_lng, location_name, photo_url, priority) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        student_email, title, description, category, department, 
        location_lat ? parseFloat(location_lat) : null, 
        location_lng ? parseFloat(location_lng) : null, 
        location_name, photo_url, priority
      );

      const newIssue = { 
        id: info.lastInsertRowid, 
        student_email, 
        title, 
        description, 
        category, 
        department, 
        location_lat: location_lat ? parseFloat(location_lat) : null,
        location_lng: location_lng ? parseFloat(location_lng) : null,
        location_name, 
        photo_url,
        priority, 
        status: 'Pending', 
        created_at: new Date().toISOString() 
      };

      broadcast({ type: 'NEW_ISSUE', data: newIssue });
      res.json(newIssue);
    } catch (err) {
      console.error("❌ Error creating issue:", err);
      res.status(500).json({ error: 'Failed to create issue. Check server logs.' });
    }
  });

  app.patch("/api/issues/:id", (req, res) => {
    try {
      const { status } = req.body;
      db.prepare("UPDATE issues SET status = ? WHERE id = ?").run(status, req.params.id);
      const updatedIssue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.id);
      broadcast({ type: 'ISSUE_UPDATED', data: updatedIssue });
      res.json(updatedIssue);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update issue' });
    }
  });

  // ========== Analytics ==========
  app.get("/api/analytics/summary", (req, res) => {
    try {
      const totalIssues = db.prepare("SELECT COUNT(*) as count FROM issues").get() as any;
      const resolvedIssues = db.prepare("SELECT COUNT(*) as count FROM issues WHERE status = 'Resolved'").get() as any;
      const highPriority = db.prepare("SELECT COUNT(*) as count FROM issues WHERE priority = 'High'").get() as any;
      const totalViews = db.prepare("SELECT SUM(views) as count FROM notices").get() as any;
      const categoryDist = db.prepare("SELECT category, COUNT(*) as count FROM issues GROUP BY category").all();
      const topQuestions = [
        { q: "When is the next semester starting?", count: 45 },
        { q: "How to apply for a scholarship?", count: 32 },
        { q: "Where is the main library located?", count: 28 },
        { q: "What is the exam schedule?", count: 24 }
      ];
      res.json({
        totalIssues: totalIssues.count,
        resolvedIssues: resolvedIssues.count,
        highPriority: highPriority.count,
        totalViews: totalViews.count || 0,
        categoryDist,
        topQuestions
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // ========== FAQs ==========
  app.get("/api/faqs", (req, res) => {
    try {
      const faqs = db.prepare("SELECT * FROM faqs").all();
      res.json(faqs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch FAQs' });
    }
  });

  // ========== Global Error Handler ==========
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ========== Vite Middleware (Development) ==========
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected via WebSocket");
    ws.on("close", () => console.log("Client disconnected"));
  });

  function broadcast(message: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

startServer();