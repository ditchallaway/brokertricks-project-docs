# Photopea URL Builder — Design Document

**Date:** 2026-05-01  
**Status:** Approved (v2 — pivoted from URL hash to embedded editor)

## Purpose

Generate URLs to an embedded Photopea editor page that opens rendered property
images with:
- The action set (`.atn`) pre-loaded in the Actions panel for boundary pop effects
- An acreage text layer automatically placed (yellow `#FFFF00`, 120pt)
- One URL per image — browser handles multiple tabs
- **CORS bypass**: the editor page fetches images from R2 as ArrayBuffers and
  passes them to Photopea via `pea.loadAsset()`, so Photopea never makes the
  cross-origin request itself.

The human editor clicks each URL, adjusts the text, runs the action set for the
pop effect, then exports.

## Architecture

```
n8n workflow
  ├── Render job → robotic-property-photographer → R2 upload
  └── Code node (photopea-url-builder.js)
        └── Generates editor URLs per image
              └── Editor opens at app.brokertricks.com/editor.html
                    ├── Fetches image from store.brokertricks.com (ArrayBuffer)
                    ├── Fetches actions.atn from app.brokertricks.com (ArrayBuffer)
                    ├── Passes both to embedded Photopea (no CORS issue)
                    ├── Runs ExtendScript to add acreage text layer
                    └── Human editor adjusts + exports
```

## Why Embedded Instead of URL Hash

The Photopea URL hash approach (`photopea.com#...`) was rejected because:
1. **CORS**: R2 custom domains + Cloudflare CDN caching made CORS headers unreliable
   for requests originating from `photopea.com`
2. **Action sets**: `.atn` files can't be loaded via the `resources` parameter
3. **Sequential operations**: The embedded API (`pea.js`) supports sequential
   async operations with delays, which the URL hash single-script approach cannot

The embedded approach (`app.brokertricks.com/editor.html`) solves all three:
- Image fetch originates from `app.brokertricks.com` (same-site as R2 store)
- Action sets load via `pea.loadAsset(arrayBuffer)`
- Full async control over the initialization sequence

## Editor Page

**Location:** `app.brokertricks.com/editor.html`  
**Source:** `/home/user/Repositories/photopea/editor.html`

### URL Parameters

| Param | Required | Example | Description |
|---|---|---|---|
| `customer_id` | ✅ | `cust_12345` | R2 path segment |
| `order_id` | ✅ | `order_12345` | R2 path segment |
| `direction` | ✅ | `north` | Shot direction |
| `acreage` | ❌ | `5.00 ACRES` | Text for acreage layer |

### Example URL
```
https://app.brokertricks.com/editor.html?customer_id=cust_12345&order_id=order_12345&direction=north&acreage=5.00%20ACRES
```

### Initialization Sequence

1. Parse query parameters
2. Create Photopea embed (`Photopea.createEmbed`)
3. Fetch action set (`.atn`) as ArrayBuffer → `pea.loadAsset()`
4. Fetch property image from R2 as ArrayBuffer → `pea.loadAsset()`
5. Run ExtendScript to add acreage text layer (yellow, 120pt)
6. Enable action buttons for the human editor

### Editor UI

- **Top bar**: Customer/order/direction/acreage metadata chips + status indicator
- **Action bar**: "Run Pop Effect" button (runs Action 0) + "Re-add Acreage Text"
- **Main area**: Full-height embedded Photopea instance

## n8n Code Node

**Location:** `scripts/photopea-url-builder.js`  
**Mode:** "Run Once for All Items"

### Inputs

| Field | Type | Example |
|---|---|---|
| `customer_id` | string | `"cust_12345"` |
| `order_id` | string | `"order_12345"` |
| `product_id` | string | `"full"` |
| `acreage` | string | `"5.00 ACRES"` |

### Product → Shot Mapping

| Product ID | Shots |
|---|---|
| `single_overhead` | `["overhead"]` |
| `single_north` | `["north"]` |
| `full` | `["north", "east", "south", "west", "overhead"]` |

### Output

Array of objects per shot:
```json
{
  "direction": "north",
  "imageUrl": "https://store.brokertricks.com/cust_12345/order_12345/property_north.png",
  "editorUrl": "https://app.brokertricks.com/editor.html?customer_id=cust_12345&order_id=order_12345&direction=north&acreage=5.00%20ACRES"
}
```
