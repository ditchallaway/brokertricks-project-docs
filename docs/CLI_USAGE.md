# Rendering CLI

## Usage

The CLI tool accepts a job JSON and generates **exactly 5 PNG images** (North, East, South, West, and Nadir).

### Via stdin:
```bash
cat job.json | node bin/render.js
```

### Via file argument:
```bash
node bin/render.js ./job.json --output ./results/
```

### Via Docker:
```bash
docker run --rm \
  -e GOOGLE_API_KEY=$KEY \
  -v $(pwd)/results:/app/results \
  renderer:latest \
  node bin/render.js ./job.json --output /app/results/
```

## Job Schema
```json
{
  "customer_id": "cust_123",
  "order_id": "order_456",
  "centroid": [-116.4869, 48.3322],
  "centroid_elevation": 655,
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[...]]]
  }
}
```
