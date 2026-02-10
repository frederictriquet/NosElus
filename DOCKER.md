# Docker Deployment Guide

This project includes a complete Docker setup with Traefik as a reverse proxy and Let's Encrypt for automatic SSL certificates.

## Architecture

- **Traefik**: Reverse proxy with automatic HTTPS via Let's Encrypt
- **SvelteKit App**: Your application running in a Node.js container
- **Network**: Docker network for inter-container communication

## Prerequisites

1. **Docker & Docker Compose**

   ```bash
   docker --version  # Should be 20.10+
   docker compose version  # Should be 2.0+
   ```

2. **Domain Name**
   - A registered domain name pointing to your server
   - DNS records configured (A record pointing to your server IP)

3. **Cloudflare Account** (Recommended)
   - For DNS challenge and SSL certificate generation
   - API Token with DNS edit permissions

## Quick Start

### 1. Setup Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DOMAIN=yourdomain.com
CF_API_EMAIL=your-email@example.com
CF_DNS_API_TOKEN=your-cloudflare-api-token
TRAEFIK_DASHBOARD_USERS=admin:$$apr1$$hashed$$password
```

### 2. Generate Traefik Dashboard Password

```bash
# Install htpasswd (if not already installed)
sudo apt-get install apache2-utils

# Generate password hash (replace 'your-password')
echo $(htpasswd -nb admin your-password) | sed -e s/\\$/\\$\\$/g
```

Copy the output to `TRAEFIK_DASHBOARD_USERS` in your `.env` file.

### 3. Create Docker Network

```bash
docker network create web
```

### 4. Start the Services

```bash
docker compose up -d
```

Check the logs:

```bash
docker compose logs -f
```

## Configuration

### Environment Variables

| Variable                  | Description                      | Required |
| ------------------------- | -------------------------------- | -------- |
| `DOMAIN`                  | Your domain name                 | Yes      |
| `CF_API_EMAIL`            | Cloudflare account email         | Yes      |
| `CF_DNS_API_TOKEN`        | Cloudflare API token             | Yes      |
| `TRAEFIK_DASHBOARD_USERS` | Basic auth for Traefik dashboard | Yes      |

### Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Create Token → Edit zone DNS
3. Permissions:
   - Zone → DNS → Edit
   - Zone → Zone → Read
4. Zone Resources:
   - Include → Specific zone → your-domain.com
5. Copy the token to `CF_DNS_API_TOKEN`

## Accessing Services

Once deployed:

- **Your App**: https://yourdomain.com
- **Traefik Dashboard**: https://traefik.yourdomain.com (requires authentication)

## Docker Commands

### View Running Containers

```bash
docker compose ps
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f traefik
```

### Restart Services

```bash
# All services
docker compose restart

# Specific service
docker compose restart app
```

### Stop Services

```bash
docker compose down
```

### Rebuild and Restart

```bash
docker compose up -d --build
```

### Remove Everything (including volumes)

```bash
docker compose down -v
```

## SSL Certificates

### How It Works

1. Traefik uses Cloudflare DNS challenge to obtain Let's Encrypt certificates
2. Certificates are automatically renewed before expiration
3. Certificates are stored in `traefik/acme.json`

### Certificate Files

- Location: `traefik/acme.json`
- Permissions: Must be `600` (set automatically)
- Backup: Recommended to backup this file regularly

### Force Certificate Renewal

If you need to force renewal:

```bash
# Stop services
docker compose down

# Remove certificate file
rm traefik/acme.json
touch traefik/acme.json
chmod 600 traefik/acme.json

# Start services (will request new certificates)
docker compose up -d
```

## Traefik Configuration

### Static Configuration

Located in `traefik/traefik.yml`:

- API/Dashboard settings
- Entry points (HTTP/HTTPS)
- Certificate resolvers
- Providers (Docker, File)

### Dynamic Configuration

Located in `traefik/config.yml`:

- Middlewares (headers, redirects)
- Security settings
- IP whitelists

## Security Features

### HTTPS Enforcement

- All HTTP traffic automatically redirects to HTTPS
- Configured in Traefik entry points

### Security Headers

Automatically applied headers:

- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)

### Traefik Dashboard Protection

- Protected by Basic Authentication
- Only accessible via subdomain (traefik.yourdomain.com)
- Credentials defined in `.env`

## Health Checks

Both services include health checks:

**App Container:**

- Endpoint: http://localhost:3000
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

**Check health status:**

```bash
docker compose ps
```

## Troubleshooting

### Certificates Not Generated

1. Check Cloudflare API credentials:

   ```bash
   docker compose logs traefik | grep cloudflare
   ```

2. Verify DNS records point to your server:

   ```bash
   dig yourdomain.com
   ```

3. Check Let's Encrypt rate limits

### App Not Accessible

1. Check if containers are running:

   ```bash
   docker compose ps
   ```

2. Check app logs:

   ```bash
   docker compose logs app
   ```

3. Verify Traefik routing:
   ```bash
   docker compose logs traefik | grep noselus
   ```

### Port Conflicts

If ports 80 or 443 are already in use:

```bash
# Check what's using the ports
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2  # or nginx
```

### Permission Issues with acme.json

```bash
chmod 600 traefik/acme.json
```

## Scaling & Production

### Multiple Instances

To run multiple app instances:

```yaml
services:
  app:
    deploy:
      replicas: 3
```

### Resource Limits

Add resource constraints:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          memory: 512M
```

### Monitoring

Add monitoring labels for Prometheus:

```yaml
labels:
  - 'traefik.http.services.noselus.loadbalancer.healthcheck.path=/health'
  - 'traefik.http.services.noselus.loadbalancer.healthcheck.interval=10s'
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/app
            git pull
            docker compose up -d --build
```

## Backup Strategy

### What to Backup

1. **Application Data**: Any persistent volumes
2. **SSL Certificates**: `traefik/acme.json`
3. **Environment Config**: `.env` (store securely!)

### Backup Script Example

```bash
#!/bin/bash
BACKUP_DIR="/backups/noselus-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup certificates
cp traefik/acme.json $BACKUP_DIR/

# Backup environment (encrypt this!)
gpg --encrypt --recipient your@email.com .env -o $BACKUP_DIR/.env.gpg

echo "Backup completed: $BACKUP_DIR"
```

## Alternative DNS Providers

While this setup uses Cloudflare, Traefik supports many DNS providers:

- AWS Route53
- Google Cloud DNS
- DigitalOcean
- And many more...

Update `traefik/traefik.yml` to use your provider. See [Traefik documentation](https://doc.traefik.io/traefik/https/acme/#providers) for details.

## Development vs Production

This setup is for **production deployment**. For development:

```bash
# Use standard development server
npm run dev
```

Don't use Docker for local development unless testing Docker-specific issues.

## Support & Resources

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Let's Encrypt](https://letsencrypt.org/)
- [SvelteKit Deployment](https://svelte.dev/docs/kit/adapters)
