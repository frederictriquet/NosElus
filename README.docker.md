# Docker Quick Reference

## Quick Start

1. **Setup**
   ```bash
   ./docker-setup.sh
   ```

2. **Configure `.env`**
   ```bash
   nano .env
   ```

3. **Start**
   ```bash
   npm run docker:up
   ```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run docker:build` | Build the Docker image |
| `npm run docker:up` | Start all services |
| `npm run docker:down` | Stop all services |
| `npm run docker:logs` | View live logs |
| `npm run docker:restart` | Restart services |

## Access Points

- **App**: https://yourdomain.com
- **Traefik Dashboard**: https://traefik.yourdomain.com

## Troubleshooting

### Check Status
```bash
docker compose ps
```

### View Logs
```bash
docker compose logs -f app
docker compose logs -f traefik
```

### Rebuild
```bash
npm run docker:build
npm run docker:up
```

## Full Documentation

See [DOCKER.md](DOCKER.md) for complete documentation.
