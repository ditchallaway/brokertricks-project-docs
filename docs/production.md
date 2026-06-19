# Production Deployment Guide

This guide outlines the essential steps and configurations needed to build and deploy the Robotic Property Photographer rendering instance in a production environment.

## 1. Prerequisites
- Docker & Docker Compose
- Minimum 4GB+ RAM recommendation (Puppeteer/Headless browser WebGL takes a lot of memory)
- A stable internet connection for tile downloading

## 2. Docker Deployment

The recommended deployment strategy for production is using the provided Docker container running headless.

### Build the Image
Build the Docker instance containing the hardware accelerated rendering dependencies:
```bash
docker build -t headless-renderer .
```

### Run the Container
Run the container, making sure to mount necessary volumes for output persistence:
```bash
# Example to run passing port 3000 to the container
docker run -d \\
  --name headless-renderer \\
  -p 3000:3000 \\
  -v $(pwd)/output:/app/output \\
  headless-renderer
```

## 3. Important Production Constraints
- **Sequential Rendering**: Keep rendering strictly sequential. Do not attempt concurrent WebGL context creation requests, otherwise the Docker container will hit SHM limits and crash.
- **Hardware Config**: Do not override the swiftshader flags unless you are providing an actual dedicated GPU.

## 4. Monitoring & Logs
Logs can be viewed directly from your docker runtime.
```bash
docker logs -f headless-renderer
```

## 5. Integrating with n8n (Upstream)
Since both n8n and the headless renderer are running in containers on the same server, you don't need external ports or complex authentication. You can connect them via a shared Docker network and use internal hostname resolution.

### Step 1: Docker Compose Configuration
Add the renderer to your existing `docker-compose.yml` where n8n is defined:

```yaml
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    # ... your other n8n config ...
    networks:
      - property-photographer-net

  headless-renderer:
    build: 
      context: ./robotic-property-photographer # path to this directory
    container_name: headless-renderer
    shm_size: '2gb' # VERY IMPORTANT: Prevents Puppeteer WebGL crashes
    networks:
      - property-photographer-net
    volumes:
      # Optional: Share a volume if n8n needs direct file access
      - ./shared_assets:/app/output

networks:
  property-photographer-net:
    driver: bridge
```

### Step 2: Calling from n8n
Inside an **HTTP Request Node** in your n8n workflow, configure it as follows:

- **Method**: `POST`
- **URL**: `http://headless-renderer:3000/render`
- **Body Content Type**: `JSON`
- **Body**: 
  ```json
  {
    "centroid": [ -74.006, 40.7128 ],
    "boundary": [ ... ]
  }
  ```
- **Timeouts**: Rendering 5 screenshots can take several seconds. Go to the node's *Settings* tab and increase the "Timeout" setting to at least `30000` (30 seconds) so n8n does not drop the connection while waiting for the rendering to finish.
