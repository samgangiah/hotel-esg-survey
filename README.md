# PHS Energy

Hotel energy & ESG survey platform — invite-only, magic-link auth, multi-
role respondents, file uploads, delegation, reports, reminders. Source for
the app behind `app.phsenergy.co.uk` (marketing at `phsenergy.co.uk`).

A browser-only preview of the survey itself is at `/demo`.

## Local dev

```bash
npm install
npm run dev
# http://localhost:3000   (use ?showAdded=true to reveal the "new" pill)
```

## Production deploy (VPS 1, Cloudflare Tunnel)

Container joins the `tunnel-network` Docker bridge and is reached via
Cloudflare Tunnel — no host ports published.

```bash
sudo git -C /opt/vps/projects/esg pull --ff-only origin main
sudo docker compose -f /opt/vps/projects/esg/docker-compose.yml up -d --build
```

In Cloudflare Zero Trust → Networks → Tunnels → `digitalrain-vps` →
Public Hostnames, point `esg.digitalrain.cloud` → `http://esg-app:3000`.
