# Pre-Deployment Checklist ✅

Complete these steps **before** pushing to GitHub:

## 1. Update WebSocket URL

In `script.js` (line 1):
```javascript
const PRODUCTION_WS_URL = 'wss://ws.your-domain.com'; // Replace with your actual domain
```

## 2. Verify Files

Make sure these files exist:
- ✅ `index.html`
- ✅ `style.css`
- ✅ `script.js`
- ✅ `server.py`
- ✅ `requirements.txt`
- ✅ `README.md`
- ✅ `.gitignore`
- ✅ `vercel.json`
- ✅ `instruct.md` (this file!)
- ✅ `openpgp.min.js`

## 3. Remove Test Files

Delete any test PGP keys:
```bash
rm *.asc 2>/dev/null
```

## 4. Git Commands

```bash
# Initialize
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Secure Chat Platform"

# Create GitHub repo and get the URL, then:
git remote add origin https://github.com/YOUR_USERNAME/SecureChat.git

# Push
git branch -M main
git push -u origin main
```

## 5. Next Steps

1. **Backend**: Follow the "Hostinger VPS" section in `instruct.md`
2. **Frontend**: Deploy on Vercel (see `instruct.md`)
3. **Domain**: Configure DNS in Hostinger (see `instruct.md`)
4. **SSL**: Set up HTTPS/WSS (see `instruct.md`)

## Important Notes

- **Don't skip** the WebSocket URL update (step 1)
- **Use `wss://`** not `ws://` for production
- **Save your PGP keys** in a secure location (not in the repo)
- **Test locally** before deploying

---

See `instruct.md` for detailed step-by-step instructions.
