# Brokertricks System Specifications & Architecture

**⚠️ AI AGENT DIRECTIVE: READ THIS FIRST**
This repository is the authoritative source of truth for the system architecture, business logic, and roadmap of Brokertricks.com. It is strictly a documentation and specification repository. 

**Do not write, propose, or inject execution code, rendering scripts, or microservices into this repository.**

The actual rendering engine (the GitHub Action-based stateless microservice utilizing CesiumJS) lives in its own isolated execution repository. If you are asked to modify image generation code, you are in the wrong environment.

## System Architecture Overview

To provide accurate guidance, maintain the following structural context of the Brokertricks production environment:

* **Core Infrastructure:** The primary environment is a single VPS running Ubuntu.
* **Routing & Proxy:** Cloudpanel acts as a reverse proxy for Nginx.
* **Frontend & Commerce:** Nginx serves the customer-facing WordPress site utilizing SureCart for order management.
* **Orchestration:** n8n runs within Docker, handling webhooks, automation, and triggering external services.
* **Rendering Pipeline:** High-GPU overhead rendering tasks run entirely in GitHub Actions as a stateless microservice. n8n dispatches payloads to this Action.
* **Fulfillment Philosophy:** Workflows adhere to a "Human in the Loop" design. Automated data enrichment processes pause for manual quality control, allowing an editor to approve and fulfill property images using Photopea before final delivery.

## Repository Structure

* `/requirements/` - Strict business rules, input/output schemas, and product definitions for map-based infographics.
* `/architecture/` - Network topology, VPS configuration, database schemas (e.g., PostgreSQL idempotency gates), and Docker Compose setups.
* `/plans/` - Historical decision logs, failed experiments (e.g., deprecated n8n subagent workflows), and future roadmap documents.

## Agent Operational Rules

1.  **Reference Only:** Treat the documents here as immutable business rules.
2.  **Context Overlap:** When analyzing issues in the execution repositories, use the specs defined here to validate if the execution code meets the broader system requirements.
3.  **Updating Specifications:** Only modify these files when explicitly instructed to update system designs, record a new architectural decision, or refine business requirements.
