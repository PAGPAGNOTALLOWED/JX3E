# Discord Webhook Protector

A secure Node.js Express backend server designed to protect Discord webhooks for Roblox Lua scripts. This server provides token-based authentication, rate limiting, and a secure proxy layer to hide your actual Discord webhook URLs.

## Features

- 🔐 **Token-Based Authentication** - Secure bearer token system with 1-hour expiry
- 🔑 **API Key Protection** - Initial authentication requires API key
- ⏱️ **Rate Limiting** - Configurable rate limits to prevent abuse
- 🔄 **Token Refresh** - Refresh tokens without re-authenticating
- 🚫 **Token Revocation** - Blacklist and revoke tokens
- 🌐 **CORS Support** - Configurable CORS origins
- 📝 **Request Logging** - Timestamped request logs
- 🧹 **Automatic Cleanup** - Expired tokens cleaned up every 60 seconds
- 🛡️ **Security First** - Input validation, error handling, and secure token generation

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- A Discord webhook URL (optional for testing)

## Setup Instructions

### 1. Clone or Download the Project

```bash
cd JX
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure the following variables:

```env
PORT=3000
API_KEY=your-super-secret-api-key-change-this
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_HERE
ALLOWED_ORIGINS=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

**Important Security Notes:**
- Generate a strong API key using: `openssl rand -hex 32` (or similar)
- Never commit your `.env` file to version control
- Use different API keys for development and production

### 4. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on port 3000 (or the port specified in `.env`).

## API Endpoints

### 1. Health Check

Check if the server is running.

**Endpoint:** `GET /health`

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

### 2. Generate Token

Generate a new authentication token.

**Endpoint:** `POST /auth/token`

**Authentication:** API Key required (X-API-Key header)

**Rate Limit:** 10 requests per 15 minutes

**Request Headers:**
```
X-API-Key: your-api-key-here
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "user123",
  "hwid": "optional-hardware-id"
}
```

**Response:**
```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2024-01-01T13:00:00.000Z",
  "expiresIn": 3600
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'
```

---

### 3. Refresh Token

Refresh an existing token to get a new one with extended expiry.

**Endpoint:** `POST /auth/refresh`

**Authentication:** Bearer token required

**Rate Limit:** None (authenticated users only)

**Request Headers:**
```
Authorization: Bearer your-token-here
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "token": "new-token-here",
  "expiresAt": "2024-01-01T13:00:00.000Z",
  "expiresIn": 3600
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json"
```

**Note:** The old token will be automatically blacklisted.

---

### 4. Revoke Token

Revoke and blacklist a token.

**Endpoint:** `POST /auth/revoke`

**Authentication:** Bearer token required

**Request Headers:**
```
Authorization: Bearer your-token-here
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "message": "Token revoked"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/auth/revoke \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json"
```

---

### 5. Send Discord Webhook

Send a message to Discord via the protected webhook.

**Endpoint:** `POST /webhook/discord`

**Authentication:** Bearer token required

**Rate Limit:** 100 requests per 15 minutes (configurable)

**Request Headers:**
```
Authorization: Bearer your-token-here
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Hello from Roblox!",
  "embeds": [
    {
      "title": "Player Event",
      "description": "A player joined the game",
      "color": 3447003
    }
  ],
  "username": "Roblox Bot",
  "avatar_url": "https://example.com/avatar.png"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook sent successfully",
  "userId": "user123"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/webhook/discord \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from Roblox!",
    "username": "Roblox Bot"
  }'
```

**Discord Webhook Payload:**
- `content` (string, optional): The message content
- `embeds` (array, optional): Array of embed objects (see [Discord Embed Documentation](https://discord.com/developers/docs/resources/channel#embed-object))
- `username` (string, optional): Override the default username
- `avatar_url` (string, optional): Override the default avatar

**Note:** At least `content` or `embeds` must be provided.

---

## Error Responses

All errors return JSON in the following format:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `400` - Bad Request (missing required fields, invalid payload)
- `401` - Unauthorized (invalid API key, token, expired token, or revoked token)
- `404` - Endpoint Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

**Example Error Response:**
```json
{
  "error": "Token expired"
}
```

---

## Deployment Guide

### Deploying to Render.com

1. **Create a New Web Service:**
   - Go to [Render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository or use the public Git URL

2. **Configure the Service:**
   - **Name:** discord-webhook-protector (or your preferred name)
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free tier is fine for testing

3. **Set Environment Variables:**
   In the Render dashboard, go to "Environment" and add:
   ```
   PORT=10000
   API_KEY=your-production-api-key-here
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_HERE
   ALLOWED_ORIGINS=*
   RATE_LIMIT_WINDOW=900000
   RATE_LIMIT_MAX=100
   NODE_ENV=production
   ```

4. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically build and deploy your application
   - Your server will be available at `https://your-app-name.onrender.com`

5. **Health Check:**
   - Render will automatically ping `/health` to ensure your service is running
   - You can test it: `curl https://your-app-name.onrender.com/health`

### Deploying to Other Platforms

**Heroku:**
```bash
heroku create your-app-name
heroku config:set API_KEY=your-key
heroku config:set DISCORD_WEBHOOK_URL=your-webhook
heroku config:set NODE_ENV=production
git push heroku main
```

**Railway:**
- Connect your GitHub repository
- Set environment variables in the Railway dashboard
- Railway will auto-deploy on push

**VPS/Server:**
```bash
# Install Node.js 18+
# Clone repository
git clone <your-repo>
cd JX
npm install

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name webhook-protector
pm2 save
pm2 startup
```

---

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port number | No | `3000` |
| `API_KEY` | Secret API key for initial authentication | Yes | - |
| `DISCORD_WEBHOOK_URL` | Your Discord webhook URL | Yes | - |
| `ALLOWED_ORIGINS` | CORS allowed origins (`*` for all) | No | `*` |
| `RATE_LIMIT_WINDOW` | Rate limit window in milliseconds | No | `900000` (15 min) |
| `RATE_LIMIT_MAX` | Max requests per window | No | `100` |
| `NODE_ENV` | Environment mode (`production` or `development`) | No | `development` |

---

## Security Best Practices

1. **API Key Security:**
   - Generate strong, random API keys (use `openssl rand -hex 32`)
   - Never commit API keys to version control
   - Use different keys for development and production
   - Rotate keys periodically

2. **Token Management:**
   - Tokens expire after 1 hour automatically
   - Revoke tokens when users log out or suspect compromise
   - Use HTTPS in production (Render.com provides this automatically)

3. **Rate Limiting:**
   - Adjust rate limits based on your use case
   - Monitor for abuse patterns
   - Consider IP-based rate limiting for additional security

4. **CORS Configuration:**
   - In production, specify exact origins instead of `*`
   - Example: `ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com`

5. **Environment Variables:**
   - Never log tokens or API keys in production
   - Use environment-specific `.env` files
   - Keep `.env` in `.gitignore`

6. **Discord Webhook:**
   - Keep your webhook URL secret
   - Regenerate webhook if compromised
   - Monitor Discord webhook usage

---

## Troubleshooting

### Server won't start

**Issue:** `Error: Cannot find module 'express'`
**Solution:** Run `npm install` to install dependencies

**Issue:** `Port 3000 is already in use`
**Solution:** Change `PORT` in `.env` or stop the process using port 3000

### Authentication fails

**Issue:** `401 Invalid API key`
**Solution:** 
- Check that `API_KEY` in `.env` matches the header value
- Ensure you're sending `X-API-Key` header (case-sensitive)

**Issue:** `401 Token expired`
**Solution:** Generate a new token using `/auth/token` endpoint

**Issue:** `401 Token has been revoked`
**Solution:** The token was revoked. Generate a new token.

### Webhook not sending

**Issue:** `500 Failed to send webhook to Discord`
**Solution:**
- Verify `DISCORD_WEBHOOK_URL` is correct in `.env`
- Check Discord webhook is still valid (not deleted)
- Ensure webhook payload format is correct
- Check Discord rate limits (you may be hitting Discord's limits)

**Issue:** `400 content or embeds is required`
**Solution:** Include at least `content` or `embeds` in the request body

### Rate limit errors

**Issue:** `429 Too many requests`
**Solution:**
- Wait for the rate limit window to reset (15 minutes default)
- Adjust `RATE_LIMIT_MAX` in `.env` if needed
- Implement client-side rate limiting

### CORS errors

**Issue:** CORS policy blocking requests
**Solution:**
- Set `ALLOWED_ORIGINS` to `*` for testing
- In production, specify exact origins: `ALLOWED_ORIGINS=https://yourdomain.com`

---

## Roblox Lua Integration Example

Here's a basic example of how to use this API from a Roblox Lua script:

```lua
local HttpService = game:GetService("HttpService")
local API_URL = "https://your-app-name.onrender.com"
local API_KEY = "your-api-key-here"
local token = nil

-- Function to get authentication token
local function getToken()
    local success, response = pcall(function()
        return HttpService:PostAsync(
            API_URL .. "/auth/token",
            HttpService:JSONEncode({
                userId = tostring(game.Players.LocalPlayer.UserId)
            }),
            Enum.HttpContentType.ApplicationJson,
            false,
            {
                ["X-API-Key"] = API_KEY
            }
        )
    end)
    
    if success then
        local data = HttpService:JSONDecode(response)
        token = data.token
        return true
    end
    return false
end

-- Function to send Discord webhook
local function sendWebhook(content, username)
    if not token then
        if not getToken() then
            warn("Failed to get token")
            return false
        end
    end
    
    local success, response = pcall(function()
        return HttpService:PostAsync(
            API_URL .. "/webhook/discord",
            HttpService:JSONEncode({
                content = content,
                username = username or "Roblox Bot"
            }),
            Enum.HttpContentType.ApplicationJson,
            false,
            {
                ["Authorization"] = "Bearer " .. token
            }
        )
    end)
    
    if success then
        local data = HttpService:JSONDecode(response)
        if data.success then
            print("Webhook sent successfully")
            return true
        end
    else
        -- Token might be expired, try refreshing
        if response:find("401") or response:find("expired") then
            token = nil
            return sendWebhook(content, username) -- Retry with new token
        end
    end
    
    return false
end

-- Example usage
sendWebhook("Player joined the game!", "Game Server")
```

**Note:** Make sure to enable HTTP requests in your Roblox game settings and handle errors appropriately.

---

## License

MIT License - feel free to use this project for your own purposes.

---

## Support

For issues, questions, or contributions, please open an issue on the repository.

**Remember:** Keep your API keys and webhook URLs secure! Never commit them to version control.

