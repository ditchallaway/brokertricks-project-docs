# Brokertricks System Specifications & Architecture

**⚠️ AI AGENT DIRECTIVE: READ THIS FIRST**
This repository is the authoritative source of truth for the system architecture, business logic, and roadmap of Brokertricks.com. It is strictly a documentation and specification repository. 

**Do not write, propose, or inject execution code, rendering scripts, or microservices into this repository.**

## System Architecture Overview

To provide accurate guidance, maintain the following structural context of the Brokertricks production environment:

* **Core Infrastructure:** The primary environment is a single VPS running Ubuntu.
* **Routing & Proxy:** Cloudpanel acts as a reverse proxy for Nginx.
* **Frontend & Commerce:** Nginx serves the customer-facing WordPress site utilizing SureCart for order management.
* **Orchestration:** n8n runs within Docker, handling webhooks, automation, and triggering external services.
* **Rendering Pipeline:** n8n's generation stack is a distributed collection of APIs:
  * **Overhead Images:** Google Static Maps API is used for top-down image rendering.
  * **Oblique Shots:** Rendering runs containerized CesiumJS Puppeteer in GitHub Actions.
  * **Image Enhancement & Enrichment:** Custom PixelFlow workflows from Segmind.com use AI to enhance the image and add layers of enrichment data graphics.
* **Fulfillment:** Order deliverables are fulfilled and accessed through the customer-facing SureCart dashboard.

## Repository Context Architecture

This repository is structured to manage operational and architectural context modularly (analogous to the skills directory pattern):

* Each functional domain maintains its own scope of truth, core operational rules, and reference specs to allow progressive context loading without cognitive or prompt bloat.
* Specifications here serve as authoritative design contracts across the distributed n8n workflows, WordPress plugins/themes, and external API integrations.

## Agent Operational Rules

1.  **Reference Only:** Treat the documents here as immutable business rules.
2.  **Context Overlap:** When analyzing issues in the execution repositories, use the specs defined here to validate if the execution code meets the broader system requirements.
3.  **Updating Specifications:** Only modify these files when explicitly instructed to update system designs, record a new architectural decision, or refine business requirements.
