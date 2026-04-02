import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = 8001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'test_database';
let db;

const connectDB = async () => {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db(dbName);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'msgrouter-secret-key-change-in-production';
const JWT_EXPIRATION = '24h';

// Auth Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ detail: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ detail: 'Admin access required' });
  }
  next();
};

// Helper Functions
const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const createToken = (userId, email, role) => {
  return jwt.sign({ user_id: userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

// Send HTTP Message Helper
const sendHttpMessage = async (targetUrl, message) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: message,
      signal: controller.signal,
      // Skip SSL verification for self-signed certs
      ...(targetUrl.startsWith('https') && {
        agent: new (await import('https')).Agent({ rejectUnauthorized: false })
      })
    });
    clearTimeout(timeout);
    
    const responseText = await response.text();
    return {
      status: response.status < 400 ? 'sent' : 'failed',
      response_code: response.status,
      response_body: responseText.substring(0, 500)
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      return { status: 'failed', response_code: null, response_body: 'Connection timeout' };
    }
    return { status: 'failed', response_code: null, response_body: `Connection error: ${error.message}`.substring(0, 200) };
  }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body;
    
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(400).json({ detail: 'Email already registered' });
    }
    
    const userDoc = {
      id: uuidv4(),
      email,
      password_hash: await hashPassword(password),
      role,
      created_at: new Date().toISOString()
    };
    
    await db.collection('users').insertOne(userDoc);
    
    res.json({
      id: userDoc.id,
      email: userDoc.email,
      role: userDoc.role,
      created_at: userDoc.created_at
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await db.collection('users').findOne({ email });
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }
    
    const token = createToken(user.id, user.email, user.role);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await db.collection('users').findOne(
      { id: req.user.user_id },
      { projection: { _id: 0, password_hash: 0 } }
    );
    
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== USER MANAGEMENT ====================

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await db.collection('users')
      .find({}, { projection: { _id: 0, password_hash: 0 } })
      .toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.put('/api/users/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = {};
    
    if (req.body.email) updateData.email = req.body.email;
    if (req.body.role) updateData.role = req.body.role;
    if (req.body.password) updateData.password_hash = await hashPassword(req.body.password);
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ detail: 'No update data provided' });
    }
    
    const result = await db.collection('users').updateOne({ id: userId }, { $set: updateData });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }
    
    const user = await db.collection('users').findOne(
      { id: userId },
      { projection: { _id: 0, password_hash: 0 } }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/users/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user.user_id) {
      return res.status(400).json({ detail: 'Cannot delete yourself' });
    }
    
    const result = await db.collection('users').deleteOne({ id: userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }
    
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== ENVIRONMENT ROUTES ====================

app.get('/api/environments', authenticate, async (req, res) => {
  try {
    const envs = await db.collection('environments')
      .find({}, { projection: { _id: 0 } })
      .toArray();
    res.json(envs);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/environments', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, address, color = '#2563EB' } = req.body;
    
    const envDoc = {
      id: uuidv4(),
      name,
      address,
      color,
      created_at: new Date().toISOString()
    };
    
    await db.collection('environments').insertOne(envDoc);
    
    const { _id, ...result } = envDoc;
    res.json(result);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.put('/api/environments/:envId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { envId } = req.params;
    const updateData = {};
    
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.address) updateData.address = req.body.address;
    if (req.body.color) updateData.color = req.body.color;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ detail: 'No update data provided' });
    }
    
    const result = await db.collection('environments').updateOne({ id: envId }, { $set: updateData });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Environment not found' });
    }
    
    const env = await db.collection('environments').findOne({ id: envId }, { projection: { _id: 0 } });
    res.json(env);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/environments/:envId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { envId } = req.params;
    
    const tenantCount = await db.collection('tenants').countDocuments({ environment_id: envId });
    if (tenantCount > 0) {
      return res.status(400).json({ detail: `Cannot delete: ${tenantCount} tenants use this environment` });
    }
    
    const result = await db.collection('environments').deleteOne({ id: envId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Environment not found' });
    }
    
    res.json({ message: 'Environment deleted' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== TENANT ROUTES ====================

app.get('/api/tenants', authenticate, async (req, res) => {
  try {
    const query = req.query.environment_id ? { environment_id: req.query.environment_id } : {};
    const tenants = await db.collection('tenants')
      .find(query, { projection: { _id: 0 } })
      .toArray();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/tenants', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, environment_id, port } = req.body;
    
    const env = await db.collection('environments').findOne({ id: environment_id });
    if (!env) {
      return res.status(404).json({ detail: 'Environment not found' });
    }
    
    const tenantDoc = {
      id: uuidv4(),
      name,
      environment_id,
      port,
      created_at: new Date().toISOString()
    };
    
    await db.collection('tenants').insertOne(tenantDoc);
    
    const { _id, ...result } = tenantDoc;
    res.json(result);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.put('/api/tenants/:tenantId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const updateData = {};
    
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.environment_id) {
      const env = await db.collection('environments').findOne({ id: req.body.environment_id });
      if (!env) {
        return res.status(404).json({ detail: 'Environment not found' });
      }
      updateData.environment_id = req.body.environment_id;
    }
    if (req.body.port !== undefined) updateData.port = req.body.port;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ detail: 'No update data provided' });
    }
    
    const result = await db.collection('tenants').updateOne({ id: tenantId }, { $set: updateData });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Tenant not found' });
    }
    
    const tenant = await db.collection('tenants').findOne({ id: tenantId }, { projection: { _id: 0 } });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/tenants/:tenantId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const templateCount = await db.collection('message_templates').countDocuments({ tenant_id: tenantId });
    if (templateCount > 0) {
      return res.status(400).json({ detail: `Cannot delete: ${templateCount} templates use this tenant` });
    }
    
    const result = await db.collection('tenants').deleteOne({ id: tenantId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Tenant not found' });
    }
    
    res.json({ message: 'Tenant deleted' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== MESSAGE TEMPLATE ROUTES ====================

app.get('/api/templates', authenticate, async (req, res) => {
  try {
    const query = req.query.tenant_id ? { tenant_id: req.query.tenant_id } : {};
    const templates = await db.collection('message_templates')
      .find(query, { projection: { _id: 0 } })
      .toArray();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/templates', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, tenant_id, body } = req.body;
    
    const tenant = await db.collection('tenants').findOne({ id: tenant_id });
    if (!tenant) {
      return res.status(404).json({ detail: 'Tenant not found' });
    }
    
    const templateDoc = {
      id: uuidv4(),
      name,
      tenant_id,
      body,
      created_at: new Date().toISOString()
    };
    
    await db.collection('message_templates').insertOne(templateDoc);
    
    const { _id, ...result } = templateDoc;
    res.json(result);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.put('/api/templates/:templateId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { templateId } = req.params;
    const updateData = {};
    
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.tenant_id) {
      const tenant = await db.collection('tenants').findOne({ id: req.body.tenant_id });
      if (!tenant) {
        return res.status(404).json({ detail: 'Tenant not found' });
      }
      updateData.tenant_id = req.body.tenant_id;
    }
    if (req.body.body) updateData.body = req.body.body;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ detail: 'No update data provided' });
    }
    
    const result = await db.collection('message_templates').updateOne({ id: templateId }, { $set: updateData });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Template not found' });
    }
    
    const template = await db.collection('message_templates').findOne({ id: templateId }, { projection: { _id: 0 } });
    res.json(template);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/templates/:templateId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const result = await db.collection('message_templates').deleteOne({ id: templateId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Template not found' });
    }
    
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== MESSAGE SENDING ====================

app.post('/api/messages/send', authenticate, async (req, res) => {
  try {
    const { environment_id, tenant_id, template_id, mrn, visit_number, room, bed, floor, edited_message } = req.body;
    
    const environment = await db.collection('environments').findOne({ id: environment_id }, { projection: { _id: 0 } });
    if (!environment) {
      return res.status(404).json({ detail: 'Environment not found' });
    }
    
    const tenant = await db.collection('tenants').findOne({ id: tenant_id }, { projection: { _id: 0 } });
    if (!tenant) {
      return res.status(404).json({ detail: 'Tenant not found' });
    }
    
    const template = await db.collection('message_templates').findOne({ id: template_id }, { projection: { _id: 0 } });
    if (!template) {
      return res.status(404).json({ detail: 'Template not found' });
    }
    
    // Build the message
    let finalMessage;
    if (edited_message) {
      finalMessage = edited_message;
    } else {
      finalMessage = template.body
        .replace(/\{\{MRN\}\}/g, mrn)
        .replace(/\{\{VISIT_NUMBER\}\}/g, visit_number)
        .replace(/\{\{ROOM\}\}/g, room)
        .replace(/\{\{BED\}\}/g, bed)
        .replace(/\{\{FLOOR\}\}/g, floor)
        .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14))
        .replace(/\{\{MSG_ID\}\}/g, uuidv4().slice(0, 8).toUpperCase());
    }
    
    // Build target URL
    const baseAddress = environment.address.replace(/\/$/, '');
    let targetUrl;
    if (baseAddress.includes('://')) {
      const [protocol, rest] = baseAddress.split('://');
      const host = rest.includes(':') ? rest.split(':')[0] : rest.split('/')[0];
      targetUrl = `${protocol}://${host}:${tenant.port}`;
    } else {
      targetUrl = `https://${baseAddress}:${tenant.port}`;
    }
    
    // Send message
    const sendResult = await sendHttpMessage(targetUrl, finalMessage);
    
    // Create audit log
    const auditLog = {
      id: uuidv4(),
      user_id: req.user.user_id,
      user_email: req.user.email,
      environment_name: environment.name,
      tenant_name: tenant.name,
      template_name: template.name,
      mrn,
      visit_number,
      message_sent: finalMessage,
      target_url: targetUrl,
      status: sendResult.status,
      response_code: sendResult.response_code,
      response_body: sendResult.response_body,
      created_at: new Date().toISOString()
    };
    
    await db.collection('audit_logs').insertOne(auditLog);
    
    res.json({
      status: auditLog.status,
      message: finalMessage,
      target_url: targetUrl,
      response_code: auditLog.response_code,
      response_body: auditLog.response_body,
      audit_id: auditLog.id
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== AUDIT LOGS ====================

app.get('/api/audit-logs', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const query = req.query.status ? { status: req.query.status } : {};
    
    const logs = await db.collection('audit_logs')
      .find(query, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/audit-logs/:auditId/reprocess', authenticate, async (req, res) => {
  try {
    const { auditId } = req.params;
    
    const originalLog = await db.collection('audit_logs').findOne({ id: auditId }, { projection: { _id: 0 } });
    if (!originalLog) {
      return res.status(404).json({ detail: 'Audit log not found' });
    }
    
    const targetUrl = originalLog.target_url;
    if (!targetUrl) {
      return res.status(400).json({ detail: 'Original message has no target URL' });
    }
    
    let finalMessage = originalLog.message_sent;
    if (!finalMessage) {
      return res.status(400).json({ detail: 'Original message content not found' });
    }
    
    // Update timestamp
    const newTimestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    finalMessage = finalMessage.replace(/\d{14}/, newTimestamp);
    
    // Send message
    const sendResult = await sendHttpMessage(targetUrl, finalMessage);
    
    // Create audit log
    const auditLog = {
      id: uuidv4(),
      user_id: req.user.user_id,
      user_email: req.user.email,
      environment_name: originalLog.environment_name,
      tenant_name: originalLog.tenant_name,
      template_name: originalLog.template_name,
      mrn: originalLog.mrn,
      visit_number: originalLog.visit_number,
      message_sent: finalMessage,
      target_url: targetUrl,
      status: sendResult.status,
      response_code: sendResult.response_code,
      response_body: sendResult.response_body,
      original_audit_id: auditId,
      created_at: new Date().toISOString()
    };
    
    await db.collection('audit_logs').insertOne(auditLog);
    
    res.json({
      status: auditLog.status,
      message: finalMessage,
      target_url: targetUrl,
      response_code: auditLog.response_code,
      response_body: auditLog.response_body,
      audit_id: auditLog.id,
      original_audit_id: auditId
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/audit-logs/bulk-reprocess', authenticate, async (req, res) => {
  try {
    const { audit_ids } = req.body;
    const results = [];
    
    for (const auditId of audit_ids) {
      try {
        const originalLog = await db.collection('audit_logs').findOne({ id: auditId }, { projection: { _id: 0 } });
        if (!originalLog) {
          results.push({ audit_id: auditId, status: 'error', message: 'Audit log not found' });
          continue;
        }
        
        const targetUrl = originalLog.target_url;
        let finalMessage = originalLog.message_sent;
        
        if (!targetUrl || !finalMessage) {
          results.push({ audit_id: auditId, status: 'error', message: 'Missing target URL or message' });
          continue;
        }
        
        // Update timestamp
        const newTimestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        finalMessage = finalMessage.replace(/\d{14}/, newTimestamp);
        
        // Send message
        const sendResult = await sendHttpMessage(targetUrl, finalMessage);
        
        // Create audit log
        const auditLog = {
          id: uuidv4(),
          user_id: req.user.user_id,
          user_email: req.user.email,
          environment_name: originalLog.environment_name,
          tenant_name: originalLog.tenant_name,
          template_name: originalLog.template_name,
          mrn: originalLog.mrn,
          visit_number: originalLog.visit_number,
          message_sent: finalMessage,
          target_url: targetUrl,
          status: sendResult.status,
          response_code: sendResult.response_code,
          response_body: sendResult.response_body,
          original_audit_id: auditId,
          created_at: new Date().toISOString()
        };
        
        await db.collection('audit_logs').insertOne(auditLog);
        
        results.push({
          original_audit_id: auditId,
          new_audit_id: auditLog.id,
          status: auditLog.status
        });
      } catch (error) {
        results.push({ audit_id: auditId, status: 'error', message: error.message });
      }
    }
    
    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    
    res.json({
      total: audit_ids.length,
      successful,
      failed,
      results
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== SCHEDULED MESSAGES ====================

app.get('/api/scheduled-messages', authenticate, async (req, res) => {
  try {
    const scheduled = await db.collection('scheduled_messages')
      .find({}, { projection: { _id: 0 } })
      .sort({ scheduled_at: 1 })
      .toArray();
    res.json(scheduled);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/scheduled-messages', authenticate, async (req, res) => {
  try {
    const { environment_id, tenant_id, template_id, mrn, visit_number, room, bed, floor, edited_message, scheduled_at } = req.body;
    
    if (!scheduled_at) {
      return res.status(400).json({ detail: 'scheduled_at is required' });
    }
    
    const scheduledTime = new Date(scheduled_at);
    if (scheduledTime <= new Date()) {
      return res.status(400).json({ detail: 'Scheduled time must be in the future' });
    }
    
    const environment = await db.collection('environments').findOne({ id: environment_id }, { projection: { _id: 0 } });
    if (!environment) {
      return res.status(404).json({ detail: 'Environment not found' });
    }
    
    const tenant = await db.collection('tenants').findOne({ id: tenant_id }, { projection: { _id: 0 } });
    if (!tenant) {
      return res.status(404).json({ detail: 'Tenant not found' });
    }
    
    const template = await db.collection('message_templates').findOne({ id: template_id }, { projection: { _id: 0 } });
    if (!template) {
      return res.status(404).json({ detail: 'Template not found' });
    }
    
    // Build message body
    let messageBody;
    if (edited_message) {
      messageBody = edited_message;
    } else {
      messageBody = template.body
        .replace(/\{\{MRN\}\}/g, mrn)
        .replace(/\{\{VISIT_NUMBER\}\}/g, visit_number)
        .replace(/\{\{ROOM\}\}/g, room)
        .replace(/\{\{BED\}\}/g, bed)
        .replace(/\{\{FLOOR\}\}/g, floor);
    }
    
    const scheduledDoc = {
      id: uuidv4(),
      user_id: req.user.user_id,
      user_email: req.user.email,
      environment_id,
      environment_name: environment.name,
      tenant_id,
      tenant_name: tenant.name,
      template_id,
      template_name: template.name,
      mrn,
      visit_number,
      room,
      bed,
      floor,
      message_body: messageBody,
      scheduled_at,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    await db.collection('scheduled_messages').insertOne(scheduledDoc);
    
    const { _id, ...result } = scheduledDoc;
    res.json(result);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/scheduled-messages/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const result = await db.collection('scheduled_messages').deleteOne({ id: messageId, status: 'pending' });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Scheduled message not found or already processed' });
    }
    
    res.json({ message: 'Scheduled message cancelled' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/scheduled-messages/process', authenticate, async (req, res) => {
  try {
    const now = new Date().toISOString();
    
    const dueMessages = await db.collection('scheduled_messages')
      .find({ status: 'pending', scheduled_at: { $lte: now } }, { projection: { _id: 0 } })
      .limit(100)
      .toArray();
    
    const results = [];
    
    for (const scheduled of dueMessages) {
      try {
        const environment = await db.collection('environments').findOne({ id: scheduled.environment_id }, { projection: { _id: 0 } });
        const tenant = await db.collection('tenants').findOne({ id: scheduled.tenant_id }, { projection: { _id: 0 } });
        
        if (!environment || !tenant) {
          await db.collection('scheduled_messages').updateOne({ id: scheduled.id }, { $set: { status: 'failed' } });
          results.push({ id: scheduled.id, status: 'failed', reason: 'Environment or tenant not found' });
          continue;
        }
        
        // Build target URL
        const baseAddress = environment.address.replace(/\/$/, '');
        let targetUrl;
        if (baseAddress.includes('://')) {
          const [protocol, rest] = baseAddress.split('://');
          const host = rest.includes(':') ? rest.split(':')[0] : rest.split('/')[0];
          targetUrl = `${protocol}://${host}:${tenant.port}`;
        } else {
          targetUrl = `https://${baseAddress}:${tenant.port}`;
        }
        
        // Finalize message
        let finalMessage = scheduled.message_body
          .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14))
          .replace(/\{\{MSG_ID\}\}/g, uuidv4().slice(0, 8).toUpperCase());
        
        // Send message
        const sendResult = await sendHttpMessage(targetUrl, finalMessage);
        
        // Create audit log
        const auditLog = {
          id: uuidv4(),
          user_id: scheduled.user_id,
          user_email: scheduled.user_email,
          environment_name: scheduled.environment_name,
          tenant_name: scheduled.tenant_name,
          template_name: scheduled.template_name,
          mrn: scheduled.mrn,
          visit_number: scheduled.visit_number,
          message_sent: finalMessage,
          target_url: targetUrl,
          status: sendResult.status,
          response_code: sendResult.response_code,
          response_body: sendResult.response_body,
          scheduled_message_id: scheduled.id,
          created_at: new Date().toISOString()
        };
        
        await db.collection('audit_logs').insertOne(auditLog);
        await db.collection('scheduled_messages').updateOne({ id: scheduled.id }, { $set: { status: sendResult.status } });
        
        results.push({ id: scheduled.id, status: sendResult.status, audit_id: auditLog.id });
      } catch (error) {
        await db.collection('scheduled_messages').updateOne({ id: scheduled.id }, { $set: { status: 'failed' } });
        results.push({ id: scheduled.id, status: 'error', reason: error.message });
      }
    }
    
    res.json({ processed: results.length, results });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const [envCount, tenantCount, templateCount, totalMessages, successful, failed] = await Promise.all([
      db.collection('environments').countDocuments({}),
      db.collection('tenants').countDocuments({}),
      db.collection('message_templates').countDocuments({}),
      db.collection('audit_logs').countDocuments({}),
      db.collection('audit_logs').countDocuments({ status: 'sent' }),
      db.collection('audit_logs').countDocuments({ status: 'failed' })
    ]);
    
    const successRate = totalMessages > 0 ? Math.round((successful / totalMessages) * 1000) / 10 : 100;
    
    res.json({
      environments_count: envCount,
      tenants_count: tenantCount,
      templates_count: templateCount,
      messages_sent: totalMessages,
      successful,
      failed,
      success_rate: successRate
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== SEED DATA ====================

app.post('/api/seed', async (req, res) => {
  try {
    const existing = await db.collection('environments').countDocuments({});
    if (existing > 0) {
      return res.json({ message: 'Data already seeded', environments: existing });
    }
    
    const defaultEnvironments = [
      { name: 'DEV', address: 'https://4.175.139.29:18443', color: '#2563EB' },
      { name: 'QA-EUS', address: 'https://20.15.35.115:28443', color: '#10B981' },
      { name: 'QC', address: 'https://98.64.161.224:18443', color: '#F59E0B' },
      { name: 'UAT', address: 'https://132.196.155.76:18443', color: '#6366F1' },
      { name: 'Weekly', address: 'https://52.185.25.146:18443', color: '#F97316' },
      { name: 'Nightly', address: 'https://52.238.254.228:18443', color: '#8B5CF6' },
      { name: 'Beta', address: 'https://64.236.63.100:18443', color: '#EC4899' },
      { name: 'Smoke', address: 'https://172.169.195.36:18443', color: '#06B6D4' },
      { name: 'LT/BP Instance 1', address: 'https://64.236.107.150:18443', color: '#84CC16' },
      { name: 'LT/BP Instance 2', address: 'https://64.236.107.150:18444', color: '#22C55E' },
      { name: 'Preprod-HA Instance 1', address: 'https://20.37.140.72:18443', color: '#3B82F6' },
      { name: 'Prod UAE', address: 'https://20.174.61.216:18443', color: '#EF4444' },
      { name: 'Prod Instance 1', address: 'https://52.230.219.206:28443', color: '#DC2626' },
      { name: 'Prod Instance 2', address: 'https://52.230.219.206:28444', color: '#B91C1C' }
    ];
    
    const envDocs = defaultEnvironments.map(env => ({
      id: uuidv4(),
      name: env.name,
      address: env.address,
      color: env.color,
      created_at: new Date().toISOString()
    }));
    
    await db.collection('environments').insertMany(envDocs);
    
    // Create default admin user
    const adminExists = await db.collection('users').findOne({ email: 'admin@msgrouter.com' });
    if (!adminExists) {
      await db.collection('users').insertOne({
        id: uuidv4(),
        email: 'admin@msgrouter.com',
        password_hash: await hashPassword('admin123'),
        role: 'admin',
        created_at: new Date().toISOString()
      });
    }
    
    res.json({ message: 'Seed data created', environments: envDocs.length });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// Root endpoint
app.get('/api/', (req, res) => {
  res.json({ message: 'MsgRouter Platform API - Node.js' });
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
};

startServer();
