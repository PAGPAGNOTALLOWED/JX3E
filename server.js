require('dotenv').config();
const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Token storage and blacklist
const tokenStore = new Map(); // Map<token, {userId, expires, createdAt}>
const blacklistedTokens = new Set(); // Set<token>

// Token expiry: 1 hour
const TOKEN_EXPIRY = 3600000; // 3600 seconds = 1 hour in milliseconds

// Middleware
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';
  
  if (allowedOrigins === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const origin = req.headers.origin;
    const origins = allowedOrigins.split(',').map(o => o.trim());
    if (origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Verify API Key Middleware
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}

// Verify Token Middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required' });
  }
  
  const token = authHeader.substring(7);
  
  // Check if token is blacklisted
  if (blacklistedTokens.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }
  
  // Check if token exists in storage
  const tokenData = tokenStore.get(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Check if token is expired
  if (Date.now() > tokenData.expires) {
    tokenStore.delete(token);
    return res.status(401).json({ error: 'Token expired' });
  }
  
  // Attach token data to request
  req.tokenData = tokenData;
  next();
}

// Rate Limiters
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { error: 'Too many authentication requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests default
  message: { error: 'Too many webhook requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generate secure token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Cleanup expired tokens
function cleanupExpiredTokens() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expires) {
      tokenStore.delete(token);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired token(s)`);
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupExpiredTokens, 60000);

// API Endpoints

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// POST /auth/token
app.post('/auth/token', verifyApiKey, authRateLimiter, (req, res) => {
  try {
    const { userId, hwid } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Generate new token
    const token = generateToken();
    const now = Date.now();
    const expires = now + TOKEN_EXPIRY;
    
    // Store token
    tokenStore.set(token, {
      userId,
      hwid: hwid || null,
      expires,
      createdAt: now
    });
    
    console.log(`✅ Token generated for userId: ${userId}`);
    
    res.json({
      success: true,
      token,
      expiresAt: new Date(expires).toISOString(),
      expiresIn: 3600 // seconds
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh
app.post('/auth/refresh', verifyToken, (req, res) => {
  try {
    const oldToken = req.headers.authorization.substring(7);
    const { userId } = req.tokenData;
    
    // Blacklist old token
    blacklistedTokens.add(oldToken);
    tokenStore.delete(oldToken);
    
    // Generate new token
    const newToken = generateToken();
    const now = Date.now();
    const expires = now + TOKEN_EXPIRY;
    
    // Store new token
    tokenStore.set(newToken, {
      userId,
      hwid: req.tokenData.hwid,
      expires,
      createdAt: now
    });
    
    console.log(`🔄 Token refreshed for userId: ${userId}`);
    
    res.json({
      success: true,
      token: newToken,
      expiresAt: new Date(expires).toISOString(),
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/revoke
app.post('/auth/revoke', verifyToken, (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);
    
    // Add to blacklist
    blacklistedTokens.add(token);
    
    // Remove from storage
    tokenStore.delete(token);
    
    console.log(`🚫 Token revoked for userId: ${req.tokenData.userId}`);
    
    res.json({
      success: true,
      message: 'Token revoked'
    });
  } catch (error) {
    console.error('Error revoking token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /webhook/discord
app.post('/webhook/discord', verifyToken, webhookRateLimiter, async (req, res) => {
  try {
    const { content, embeds, username, avatar_url } = req.body;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.error('❌ DISCORD_WEBHOOK_URL not configured');
      return res.status(500).json({ error: 'Webhook URL not configured' });
    }
    
    // Prepare Discord webhook payload
    const payload = {};
    
    if (content) payload.content = content;
    if (embeds) payload.embeds = embeds;
    if (username) payload.username = username;
    if (avatar_url) payload.avatar_url = avatar_url;
    
    // Validate payload has at least content or embeds
    if (!payload.content && !payload.embeds) {
      return res.status(400).json({ error: 'content or embeds is required' });
    }
    
    // Forward to Discord webhook
    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📤 Webhook sent successfully for userId: ${req.tokenData.userId}`);
      
      res.json({
        success: true,
        message: 'Webhook sent successfully',
        userId: req.tokenData.userId
      });
    } catch (discordError) {
      console.error('Discord webhook error:', discordError.response?.data || discordError.message);
      
      // Return error but don't expose Discord's response details
      res.status(500).json({
        error: 'Failed to send webhook to Discord',
        message: 'The webhook request was rejected by Discord'
      });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Server Initialization
if (!process.env.API_KEY) {
  console.warn('⚠️  WARNING: API_KEY not set in environment variables');
}

if (!process.env.DISCORD_WEBHOOK_URL) {
  console.warn('⚠️  WARNING: DISCORD_WEBHOOK_URL not set in environment variables');
}

// Log API key in development (first 8 chars only)
if (process.env.NODE_ENV !== 'production' && process.env.API_KEY) {
  console.log(`🔑 API Key: ${process.env.API_KEY.substring(0, 8)}...`);
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ Production mode - API keys will not be logged');
  }
});

