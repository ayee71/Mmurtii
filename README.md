# SeeraAI Pro (SAI Ethio)

Professional trilingual Ethiopian legal research, statutory reference, document analysis, and courtroom workflow platform supporting **Afaan Oromoo**, **Amharic (አማርኛ)**, and **English**.

## Key Features
- **Trilingual Legal Q&A & Analysis:** Grounded Ethiopian Federal & Oromia statutory lookup and Cassation Bench precedent search.
- **Document Viewer & Reading Mode:** Distraction-free reading mode (`Alt+R`), citation highlighting, and trilingual export.
- **Document & Case Management:** Institutional document repository, court workflow tracking, and witness/audio tools.
- **Telegram Legal Feed & Admin Diagnostics:** Webhook configuration, live fetch testing, and legal channel archive sync.

## Local Development

1. Install dependencies (requires **Node.js >= 22.12.0**):
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure your server-side secrets (`GEMINI_API_KEY`, Firebase, Telegram tokens).
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Build and start for production:
   ```bash
   npm run build
   npm start
   ```
