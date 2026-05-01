# Hotel Energy & ESG Survey — UI demo

A polished, browser-only survey demo for UK hotels. No backend, no persistence,
no upload — `submit` shows a review screen. The form is rendered generically
from `data/questions.json`.

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
