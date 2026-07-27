# SureCart Integration Architecture

## Customer Role and Access Constraints

**Role: `sc_customer`**

When a customer makes a purchase through SureCart, they are created as a WordPress user with the `sc_customer` role.

**CRITICAL ARCHITECTURE CONSTRAINT:**
* Users with the `sc_customer` role **never enter the WordPress admin dashboard (`/wp-admin`)**.
* They are restricted entirely to the frontend customer dashboard provided by SureCart (e.g., `/dash` or `/customer-dashboard`).
* SureCart order notes (via the `/v1/notes` API) are **admin-only**. They are visible to administrators inside the WordPress backend, but they are **not exposed** to the `sc_customer` role in the frontend dashboard.

## Fulfillment & Download Delivery

Because customers cannot view admin order notes, digital fulfillment involving custom URLs (such as rendered images, KML files, and external links) must be delivered through custom frontend mechanisms rather than relying on native SureCart notes display.

### 1. Post-Purchase Fulfillment Page
Instead of showing a default SureCart "Thank You" page, orders are redirected to a custom Fulfillment Page (`/fulfillment/`).
* **Mechanism**: The fulfillment page uses a client-side JavaScript polling script that queries the WordPress REST API proxy for SureCart (`/wp-json/surecart/v1/notes?notable_id=...`).
* **Display**: Once the n8n backend generates the custom digital assets, it writes a note containing the metadata to the order. The frontend script detects this note and dynamically renders the download buttons/gallery for the customer.

### 2. Dashboard Re-entry (Downloads Tab)
When a customer returns to their SureCart dashboard later and visits the "Downloads" tab:
* SureCart natively displays a placeholder file.
* **Mechanism**: A JavaScript click-interceptor on the dashboard page (`is_page('dash')`) prevents the default download action of this placeholder.
* **Display**: It extracts the order ID from the URL/DOM and redirects the customer back to the custom Fulfillment Page (`/fulfillment/?sc_order=...`), where the actual dynamically generated assets are retrieved and displayed.

### 3. Backend Generation (n8n)
* The n8n automation creates the digital assets (via the headless renderer or KML generator).
* n8n uses the SureCart API to attach an **admin-only note** to the order containing the structured metadata (URLs to assets).
* n8n then optionally patches the order's fulfillment status (e.g., to "delivered" or leaves as "unshippable" based on product configuration).
