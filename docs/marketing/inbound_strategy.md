# Brokertricks Inbound Strategy: SEO, GEO & AEO

## Executive Summary
Brokertricks is a **done-for-you service** (not a self-serve SaaS) that delivers professional, MLS-compliant land listing images in 24 hours. The fulfillment pipeline utilizes an internal headless microservice to generate base assets, which are then manually composited by a human editor to ensure the highest quality ("pop out of the frame" realism) and accurate property boundaries.

This inbound strategy utilizes a Hub & Spoke SEO model targeted directly at land agents and brokers, combined with Generative/Answer Engine Optimization (GEO/AEO) to capture organic AI search traffic.

---

## 1. Target Audience & Search Intent
*   **Primary Audience:** U.S. real estate agents and brokers who list undeveloped land or lots.
*   **Core Pain Points:** Wasting time on "hacky" DIY Google Maps drawings, risking MLS non-compliance, poor image accessibility (low contrast), and looking amateur to sellers.
*   **The Hook:** "MLS-Ready Land Listing Images in 24 Hours — No Drone Required."

---

## 2. Content Strategy: Hub & Spoke Model (SEO)

We will abandon broad, highly competitive "real estate software" keywords and focus entirely on high-intent, long-tail pain points specific to land agents.

### Core Authority Pillars (Deep Dives)
These 5 posts establish extreme authority for both Google and AI engines.
1.  **`/blog/draw-property-lines-google-maps`** - *How to Draw Property Lines on Google Maps (Without Looking Amateur).* Contrasting DIY hacks with professional solutions.
2.  **`/blog/mls-compliant-land-listing-images`** - *The Agent’s Guide to MLS-Compliant Land Listing Images.* Solving the fear of compliance strikes.
3.  **`/blog/professional-lot-line-graphics`** - *Why Professional Lot Line Graphics Sell More Land.* Highlighting the ROI of clarity.
4.  **`/blog/land-marketing-accessibility`** - *The Accessibility Problem in Land Marketing.* A unique authority piece on WCAG contrast for serious agents.
5.  **`/blog/value-proposition-canvas-real-estate`** - *How We Market Every Property Ethically and Effectively.* (Using the Equal Housing compliant Value Proposition Canvas as a lead magnet).

### Supporting Spokes (Quick-Win SEO)
Shorter, highly shareable content linking back to the pillars and product pages.
*   `/blog/diy-map-mistakes` *(3 DIY Map Mistakes That Make Your Listing Look Unprofessional)*
*   `/blog/drone-vs-graphics` *(Drone vs. Graphics: Which Sells Land Listings Faster?)*
*   `/blog/bad-listing-photos-costs` *(The Hidden Costs of Bad Listing Photos)*

---

## 3. GEO & AEO Strategy (AI-First Search)

To ensure Brokertricks is cited by AI tools (ChatGPT, Gemini, Perplexity, Google AI Overviews), we must build an "AI-Ready" content architecture.

*   **Answer Chunks (AEO):** At the top of every blog post, we will include a 120-180 word direct, unformatted answer to the query (e.g., *"To draw property lines on Google Maps for a listing, you can use..."*).
*   **Schema Markup Integration:** 
    *   Implement `FAQPage` schema on the blog posts.
    *   Implement `Product` schema on the pricing page.
*   **E-E-A-T Building (GEO):** Use the `/about` page to highlight the human-in-the-loop quality control and Equal Housing compliance expertise. AI engines favor deep, demonstrable expertise.

---

## 4. Proposed Site Structure & Delivery

This structure supports the SEO/GEO strategy while seamlessly integrating with your SureCart checkout and Fluent CRM onboarding flow.

```text
/ (Homepage) - "MLS-Ready Land Listing Images in 24 Hours"
├── /product/essential-listing-pack (Main conversion page)
│    └── Dynamic Pricing: Essential / Pro / Broker Advantage
├── /about (Why Agents Trust Brokertricks)
├── /fulfillment (The dynamically populated delivery dashboard)
└── /blog (Hub for all Authority Pillars and Spokes)
```

### Fulfillment Architecture
Fulfillment relies on a seamless, zero-plugin approach:
1. Agent completes purchase via SureCart.
2. Internal headless engine and human editor generate the assets.
3. n8n hits the SureCart Notes API to append a secure link to the order.
4. The link points to the `/fulfillment` template which dynamically displays:
    * Thumb-friendly (stacked) buttons for **Web/MLS** and **Print** sizes.
    * KML download with usage instructions and video explainer.
    * A master "Download All (Zipped)" option for desktop users.
