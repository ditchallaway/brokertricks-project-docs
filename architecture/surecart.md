# SureCart Integration Architecture

## Customer Role and Access Constraints

**Role: `sc_customer`**

When a customer makes a purchase through SureCart, they are created as a WordPress user with the `sc_customer` role.

**CRITICAL ARCHITECTURE CONSTRAINT:**
* Users with the `sc_customer` role **never enter the WordPress admin dashboard (`/wp-admin`)**.
* They are restricted entirely to the frontend customer dashboard provided by SureCart (e.g., `/dash` or `/customer-dashboard`).
* SureCart order notes (via the `/v1/notes` API) are **admin-only**. They are visible to administrators inside the WordPress backend, but they are **not exposed** to the `sc_customer` role in the frontend dashboard.

## Fulfillment & Download Delivery

Because customers cannot view admin order notes, digital fulfillment involving custom URLs (such as rendered images and external links) must be delivered through custom frontend mechanisms rather than relying on native SureCart notes display.

### 1. Post-Purchase Fulfillment Page
Instead of showing a default SureCart "Thank You" page, orders are redirected to a custom Fulfillment Page (`/fulfillment/`).
* **Mechanism**: The fulfillment page uses a client-side JavaScript polling script that queries the WordPress REST API proxy for SureCart (`/wp-json/surecart/v1/notes?notable_id=...`).
* **Display**: Once the n8n backend generates the custom digital assets, it writes a note containing the metadata to the order. The frontend script detects this note and dynamically renders the download buttons/gallery for the customer.

### 2. Dashboard Re-entry (Downloads Tab)
When a customer returns to their SureCart dashboard later and visits the "Downloads" tab:
* SureCart natively displays a placeholder file.
* **Mechanism**: A JavaScript click-interceptor on the dashboard page (`is_page('dash')`) prevents the default download action of this placeholder.
  * *Code Location Roadmap:* This script currently resides in a custom scripts plugin, will be moved into the theme, and will eventually migrate into a dedicated custom plugin.
* **Display Evolution:**
  * *Current State:* Orders are displayed in a list where each list item is an order containing one or more downloads directly within that list item.
  * *Target State:* Each list item will link to a dedicated order page or popover modal. This view not only provides download links, but also displays the images for a more premium feel.

### 3. Backend Generation & Lifecycle (n8n)
* The n8n automation orchestrates the generation of the digital assets (parcel KML generation is a lead magnet, not a product deliverable, and is handled separately).
* n8n uses the SureCart API to attach an **admin-only note** to the order containing the structured metadata (URLs to assets).
* **Fulfillment Status:** Once deliverables are made available, n8n patches the order's fulfillment status to `fulfilled` (mandatory).
