# Chat App

A full-featured social chat platform with real-time messaging, AI chat assistant, stories, posts, and wallet-style transfers.

## Apps Overview

This project is split into three apps:

- `Backend/` → REST API, authentication, stories, posts, payments, and AI endpoints
- `Client/` → main frontend application
- `Socket/` → real-time socket server for live messaging

## Folder Structure

```text
Chat App/
|-- Backend/
|   |-- server.js
|   |-- controllers/
|   |-- routes/
|   |-- middleware/
|   |-- lib/
|   |-- prisma/
|   `-- package.json
|-- Client/
|   |-- src/
|   |-- public/
|   |-- index.html
|   |-- vite.config.js
|   `-- package.json
|-- Socket/
|   |-- socketServer.js
|   `-- package.json
`-- ...
## Features:
  -> Secure user auth and profile management
  -> Real-time private messaging
  -> AI assistant chat endpoint
  -> Story feed with view tracking
  -> Post feed with likes, reactions, and replies
  -> Wallet transfer and transaction history

## Environment Variables : Backend (Backend/.env)
    MONGODB_URL=
    PORT=5000
    JWT_SECRET=

    OLLAMA_BASE_URL=http://127.0.0.1:11434
    OLLAMA_MODEL=llama3.2
    AI_TIMEOUT_MS=180000

## Run the Project:
  Start all three apps in separate terminals:
    -> npm run dev --prefix Backend
    -> npm run dev --prefix Client
    -> npm run dev --prefix Socket

  Default URLs:
    -> Backend API: http://localhost:5000
    -> Frontend: http://localhost:5173
    -> Socket server: http://localhost:4000
