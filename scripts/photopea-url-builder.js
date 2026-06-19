/**
 * Photopea URL Builder — n8n Code Node
 * 
 * Generates editor URLs for the embedded Photopea page at app.brokertricks.com.
 * Each URL opens a specific property image in the editor with:
 * - The action set (.atn) pre-loaded for boundary "pop" effects
 * - An acreage text layer automatically placed (yellow #FFFF00, 120pt)
 * - One URL per image — each opens in its own browser tab
 *
 * The editor page fetches images from R2 as ArrayBuffers, bypassing CORS
 * entirely since Photopea never makes the cross-origin request itself.
 *
 * MODE: "Run Once for All Items"
 *
 * EXPECTED INPUT ($input.first().json):
 *   customer_id  — e.g. "cust_12345"
 *   order_id     — e.g. "order_12345"
 *   product_id   — "single_overhead" | "single_north" | "full"
 *   acreage      — e.g. "5.00 ACRES"
 *
 * OUTPUT: Array of { direction, imageUrl, editorUrl } objects
 */

// ── Config ──────────────────────────────────────────────────────────
const EDITOR_BASE  = "https://app.brokertricks.com/editor.html";
const R2_BASE      = "https://store.brokertricks.com";

// Product → which shots get URLs
const PRODUCT_SHOTS = {
  single_overhead: ["overhead"],
  single_north:    ["north"],
  full:            ["north", "east", "south", "west", "overhead"],
};

// ── Input ───────────────────────────────────────────────────────────
const data = $input.first().json;

// Support both direct fields and webhook .body nesting
const input = data.body || data;

const customer_id = input.customer_id;
const order_id    = input.order_id;
const product_id  = input.product_id || "full";
const acreage     = input.acreage    || "";

// Validate required fields
if (!customer_id || !order_id) {
  return [{
    json: {
      error: "Missing required fields: customer_id and order_id",
      customer_id,
      order_id,
    }
  }];
}

// Resolve shot list from product type
const shots = PRODUCT_SHOTS[product_id];
if (!shots) {
  return [{
    json: {
      error: `Unknown product_id: "${product_id}". Expected: ${Object.keys(PRODUCT_SHOTS).join(", ")}`,
      product_id,
    }
  }];
}

// ── Build Editor URLs ───────────────────────────────────────────────
function buildEditorUrl(direction, customerId, orderId, acreageText) {
  const query = {
    customer_id: customerId,
    order_id: orderId,
    direction: direction,
  };

  if (acreageText) {
    query.acreage = acreageText;
  }

  // Manual query string construction for maximum compatibility in n8n environments
  const queryString = Object.keys(query)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');

  return `${EDITOR_BASE}?${queryString}`;
}

// ── Generate output ─────────────────────────────────────────────────
const results = shots.map(direction => {
  const imageUrl  = `${R2_BASE}/${customer_id}/${order_id}/property_${direction}.png`;
  const editorUrl = buildEditorUrl(direction, customer_id, order_id, acreage);

  return {
    json: {
      direction,
      imageUrl,
      editorUrl,
      customer_id,
      order_id,
      product_id,
      acreage,
    }
  };
});

return results;
