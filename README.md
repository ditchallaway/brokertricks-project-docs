# Brokertricks GeneratePress Child Theme

This child theme powers the custom WordPress platform for **Brokertricks**, a digitally enabled service delivering automated and visual real estate assets. 

Developers building or extending features within this theme should account for the active environment dependencies and automatic deployment workflow detailed below.

---

## Active Environment & Dependencies

When adding features, custom templates, or function hooks to this theme, keep in mind that the following core plugins are installed and active on the site:

* **SureCart:** Handles commerce functionality, order processing, custom customer roles, and digital service checkout flows.
* **Secure Custom Fields (SCF):** Manages structured custom fields, metadata extensions, and content models across post types.

Ensure any new PHP snippets, custom block templates, or REST API extensions interact safely with these plugins when applicable.

---

## Deployment Architecture

**Important Context for Development:** 
All code modifications should be made to the local clones in this repository. 

This environment automatically deploys changes to the production server via an automated Git webhook pipeline upon pushing to the `main` branch.

### Deployment Flow:
1. **Local Modifications:** Make and test your PHP, CSS, and JS changes locally.
2. **Commit and Push:** Commit your changes to the local Git repository and push them to GitHub (`main` branch).
3. **Webhook Trigger:** Pushing to GitHub fires an authenticated POST payload with an HMAC SHA-256 signature (`X-Hub-Signature-256`) to the VPS webhook endpoint (`http://104.168.102.178:3001/webhook`).
4. **Server Pull:** A Node.js Express service (`webhook.js`) managed by PM2 listens on port `3001`, verifies the GitHub secret signature, and automatically executes `git pull origin main` to pull the latest changes directly into the live theme directory (`/home/brokertricks/htdocs/brokertricks.com/wp-content/themes/generatepress-child`).

---

## Webhook Service Management (VPS)

* **Script Location:** Located outside the web root (e.g., `~/webhook.js`).
* **Port / Firewall:** Operates on port `3001` (requires UFW rule `sudo ufw allow 3001/tcp`).
* **Process Manager:** Managed via PM2 under the process name `github-webhook`.

**Useful Server Commands:**
```bash
# View live webhook logs
pm2 logs github-webhook

# Check process status
pm2 status

# Restart the listener
pm2 restart github-webhook
