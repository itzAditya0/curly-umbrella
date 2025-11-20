# Secure Chat - Deployment Instructions

This guide will walk you through deploying your Secure Chat application with:
- **Frontend**: Vercel (free hosting)
- **Backend**: Hostinger VPS
- **Domain**: Hostinger domain manager

---

## Table of Contents
1. [Pre-Deployment Setup](#pre-deployment-setup)
2. [GitHub Setup](#github-setup)
3. [Backend Deployment (Hostinger VPS)](#backend-deployment-hostinger-vps)
4. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
5. [Domain Configuration (Hostinger)](#domain-configuration-hostinger)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Setup

### 1. Update WebSocket Configuration

Before deploying, you need to configure the WebSocket URL in `script.js`:

```javascript
// In script.js, find this line (around line 1):
const PRODUCTION_WS_URL = ''; // Currently empty

// Update it to your Hostinger VPS domain:
const PRODUCTION_WS_URL = 'wss://your-domain.com'; // Replace with your actual domain
```

**Important**: Use `wss://` (WebSocket Secure) not `ws://` for production!

### 2. Verify `.gitignore`

Make sure your `.gitignore` file excludes sensitive files:

```
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
*.log
.DS_Store
*.asc
*.pgp
```

### 3. Create `vercel.json`

This file is already created for you. It tells Vercel how to serve your frontend.

---

## GitHub Setup

### 1. Initialize Git Repository

```bash
cd /Users/itzaditya/Codez/SecChat
git init
git add .
git commit -m "Initial commit: Secure Chat Platform"
```

### 2. Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the **"+"** icon → **"New repository"**
3. Name it: `SecureChat` (or any name you prefer)
4. **DO NOT** initialize with README (you already have one)
5. Click **"Create repository"**

### 3. Push to GitHub

```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/SecureChat.git
git branch -M main
git push -u origin main
```

---

## Backend Deployment (Render.com - Free Tier)

Render.com offers free hosting for backend services, perfect for our WebSocket server.

### 1. Create `render.yaml` Configuration

I've already created this file for you. It tells Render how to deploy your backend.

### 2. Sign Up for Render

1. Go to [Render.com](https://render.com)
2. Click **"Get Started"**
3. Sign up with GitHub (easier integration)

### 3. Create New Web Service

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect" to your GitHub repository** (`SecureChat`)
3. Configure:
   - **Name**: `secchat-backend` (or any name)
   - **Environment**: `Python 3`
## Local Development
1. Install dependencies: `pip install -r requirements.txt`
2. Run the unified server: `python server_render.py`
3. Open `http://localhost:8765` in your browser.

(No need to run a separate http.server anymore!)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Plan**: **Free** (select this!)

4. Click **"Create Web Service"**

Render will deploy your backend and give you a URL like:
`https://secchat-backend.onrender.com`

**Important**: The free tier sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake up.

### 4. Get Your WebSocket URL

Your WebSocket URL will be:
```
wss://secchat-backend.onrender.com
```

**Note**: Render automatically provides HTTPS/WSS, so you don't need to configure SSL!

### 5. Update Frontend Configuration

Update `script.js` (line 1):
```javascript
const PRODUCTION_WS_URL = 'wss://secchat-backend.onrender.com';
```

Then commit and push to trigger Vercel redeployment:
```bash
git add script.js
git commit -m "Update WebSocket URL for production"
git push origin main
```

---

## Frontend Deployment (Vercel)

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

Or use the Vercel dashboard instead (easier).

### 2. Deploy via Vercel Dashboard

1. Go to [Vercel](https://vercel.com)
2. Sign in with GitHub
3. Click **"Add New Project"**
4. **Import** your `SecureChat` repository
5. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `.` (leave as is)
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
6. Click **"Deploy"**

Vercel will deploy your frontend and give you a URL like: `https://secure-chat-xyz.vercel.app`

### 3. Custom Domain (Optional)

If you want to use your Hostinger domain for the frontend too:

1. In Vercel → Your Project → **Settings** → **Domains**
2. Add your domain: `chat.your-domain.com`
3. Vercel will give you DNS records
4. Go to Hostinger DNS settings and add those records

---

## Domain Configuration (Hostinger)

### 1. Point Domain to VPS

1. Log in to [Hostinger](https://hostinger.com)
2. Go to **Domains** → Select your domain
3. Click **DNS / Nameservers**
4. Add/Update these A records:

| Type | Name | Value (IP Address) | TTL |
|------|------|-------------------|-----|
| A | @ | YOUR_VPS_IP | 3600 |
| A | www | YOUR_VPS_IP | 3600 |

**Save changes**. DNS propagation can take up to 48 hours (usually much faster).

### 2. Subdomain for WebSocket (Recommended)

Create a subdomain for the WebSocket server:

| Type | Name | Value (IP Address) | TTL |
|------|------|-------------------|-----|
| A | ws | YOUR_VPS_IP | 3600 |

This gives you: `ws.your-domain.com` for the WebSocket server.

Update `script.js`:

```javascript
const PRODUCTION_WS_URL = 'wss://ws.your-domain.com';
```

---

## SSL/TLS Setup

### 1. Install Certbot on VPS

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Install Nginx (Reverse Proxy)

```bash
sudo apt install nginx -y
```

### 3. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/secchat
```

Paste this configuration (replace `your-domain.com`):

```nginx
server {
    listen 80;
    server_name ws.your-domain.com;

    location / {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Save and exit.

### 4. Enable the Configuration

```bash
sudo ln -s /etc/nginx/sites-available/secchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Get SSL Certificate

```bash
sudo certbot --nginx -d ws.your-domain.com
```

Follow the prompts. Certbot will automatically configure SSL for you.

Now your WebSocket URL is: `wss://ws.your-domain.com`

---

## Testing

### 1. Test WebSocket Connection

```bash
# On your local machine
wscat -c wss://ws.your-domain.com
```

If you don't have `wscat`:
```bash
npm install -g wscat
```

You should receive a `WELCOME` message with a user ID.

### 2. Test Frontend

1. Visit your Vercel URL or custom domain
2. Click "Generate New Keys"
3. Check if it connects (green dot in header)
4. Copy your ID and open in another browser
5. Add each other as friends and test messaging

---

## Troubleshooting

### WebSocket Connection Fails

1. **Check Firewall**:
   ```bash
   sudo ufw allow 8765
   sudo ufw allow 'Nginx Full'
   ```

2. **Check Service Status**:
   ```bash
   sudo systemctl status secchat
   sudo journalctl -u secchat -f
   ```

3. **Check Nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

### DNS Not Resolving

- Wait 24-48 hours for full propagation
- Check DNS with: `nslookup ws.your-domain.com`
- Verify A records in Hostinger dashboard

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## Updating Your Deployment

### Update Frontend (Vercel)

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

Vercel automatically redeploys on push.

### Update Backend (Hostinger VPS)

```bash
ssh username@your-vps-ip
cd ~/SecureChat
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart secchat
```

---

## Security Notes

1. **Never commit private keys** to Git (already excluded in `.gitignore`)
2. **Use strong passwords** for your VPS
3. **Keep your server updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
4. **Monitor logs** regularly:
   ```bash
   sudo journalctl -u secchat -f
   ```

---

## Summary

✅ Code pushed to GitHub  
✅ Backend running on Hostinger VPS with SSL  
✅ Frontend deployed on Vercel  
✅ Domain configured with Hostinger  
✅ WebSocket secured with `wss://`  

Your Secure Chat is now live! 🎉

**Frontend URL**: `https://your-vercel-url.vercel.app` or `https://your-domain.com`  
**WebSocket URL**: `wss://ws.your-domain.com`

---

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Hostinger Support**: https://www.hostinger.com/tutorials/vps
- **Certbot Guide**: https://certbot.eff.org/

Good luck with your deployment! 🚀
