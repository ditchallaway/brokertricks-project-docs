# System Design: Zero-Touch KML Auto-Fulfillment & Print-on-Demand Swag
Date: 2026-07-08

## 1. Architectural Divergence: Zero-Touch vs. Human-in-the-Loop

Our system historically enforced a strict **"Human-in-the-Loop"** philosophy. All orders paused at the Photopea editor stage for a human admin to align rendering layers before clicking "Fulfill", which marked the SureCart order as delivered.

With the introduction of the **KML-Only Pack**, we have introduced a **Zero-Touch Auto-Fulfill** branch in `render.workflow.ts`:

- **Image Packs (Full/Double/Single)**:
  - Route through the standard rendering pipeline.
  - Dispatch the `Robotic-Property-Photographer` via GitHub Actions.
  - Suspend execution until the human editor validates the URL variables and clicks "Approve & Fulfill".
- **KML-Only Packs**:
  - The workflow detects `pack === 'kml_only'`.
  - Instantly uploads the static `property_map.png` and `parcel_boundary.kml` to the R2 bucket.
  - Automatically triggers an HTTP PATCH to SureCart’s Fulfillment API, marking the order `delivered`.
  - The customer is redirected to the `/fulfillment/` page where the assets are immediately ready for download, entirely bypassing the human editor.

### Important Structural Update: S3 Buckets
To support seamless Photopea editor integration across both paths, all output assets are now strictly namespaced in the R2 bucket under `cust_{customer_id}/order_{order_id}/`. The static base map is standardly named `property_map.png`.

---

## 2. Print-on-Demand (POD) Custom Swag Architecture

To leverage the high-quality assets generated during checkout, we have designed a cross-sell pipeline that generates custom Print-on-Demand (POD) swag (e.g., Yard Signs, Leaflets, Mugs) using the customer's specific property, logo, and brand colors.

### 2.1 The Customer Journey Flow

1. **Checkout Redirect**: After purchase, the customer is routed to a custom WordPress page `/branding-setup/?sc_order={id}`.
2. **Onboarding Form**: They enter their **Brokerage Name**, choose their **Brand Colors**, and upload their **Logo** (PNG/SVG).
3. **Data Persistence**: Choices are saved to WordPress User Meta, meaning future purchases skip this step and automatically inherit their branding.
4. **Mockup Generation**: An automated headless Photopea script (or GitHub Action) overlays their branding onto PSD templates and injects their rendered property imagery.
5. **Swag Shop**: The `/fulfillment/` page displays a "Your Custom Marketing Shop" gallery showcasing these personalized mockups with one-click SureCart purchase buttons.

### 2.2 n8n & Printify Fulfillment Pipeline
When the customer clicks to buy a Swag item from their dashboard:
1. **Trigger**: SureCart triggers a webhook on `order.paid`.
2. **Asset Retrieval**: n8n pulls the high-resolution, print-ready file from S3 (`cust_{user_id}/order_{order_id}/mockups/yard_sign_print.png`).
3. **Printify Integration**:
   - The n8n Printify community node uploads the S3 print file URL to the customer's Printify image library.
   - n8n calls Printify to **Create Order** specifying the product variant ID, the customer's shipping address, and the uploaded image positioning.
   - n8n sends a POST request to Printify to release the order for production.

This ensures a fully automated, zero-inventory fulfillment process.
