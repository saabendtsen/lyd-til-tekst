# Lyd til Tekst

Diktat-værktøj til små erhvervsdrivende. Upload lydfil → Whisper transskription → valgfri Gemini bearbejdning.

## URL
https://wibholmsolutions.com/lyd-til-tekst

## Arkitektur

```
lyd-til-tekst/
├── backend/           # FastAPI (port 8090)
│   └── src/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── auth/      # Bruger-auth (JWT)
│       └── transcription/  # Whisper + Gemini
└── frontend/          # Astro + React + Tailwind
    └── src/
        ├── pages/
        └── components/
```

## Kommandoer

### Backend
```bash
cd ~/projects/lyd-til-tekst/backend
source venv/bin/activate
uvicorn src.main:app --host 127.0.0.1 --port 8090 --reload
```

### Frontend
```bash
cd ~/projects/lyd-til-tekst/frontend
npm run dev      # Development
npm run build    # Production build
```

### Service
```bash
systemctl --user status lyd-til-tekst
systemctl --user restart lyd-til-tekst
journalctl --user -u lyd-til-tekst -f
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Opret bruger
- `POST /api/auth/login` - Login → JWT cookie
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Nuværende bruger

### Transcription
- `POST /api/transcribe` - Upload fil → Whisper
- `GET /api/transcriptions` - Brugerens historik
- `GET /api/transcriptions/{id}` - Enkelt transskription
- `PUT /api/transcriptions/{id}` - Opdater rå tekst
- `POST /api/transcriptions/{id}/process` - Kør Gemini
- `DELETE /api/transcriptions/{id}` - Slet

### Images (Gemini 3 Pro Image / Nano Banana Pro)
- `POST /api/images/generate` - Generer billede fra tekst
  - `prompt`: Tekst beskrivelse
  - `session_id`: (valgfri) Tidligere generation ID for multi-turn editing
  - `transcription_id`: (valgfri) Link billede til transskription
  - `aspect_ratio`: 1:1, 16:9, 9:16, 4:3, 3:4
  - `resolution`: 1k, 2k, 4k
- `GET /api/images/` - Brugerens billede-historik
- `GET /api/images/{id}` - Billede metadata
- `GET /api/images/{id}/data` - Rå billede data (PNG)
- `GET /api/images/transcription/{id}` - Billeder for en transskription
- `DELETE /api/images/{id}` - Slet billede

**Billedgenerering noter:**
- Multi-turn editing kræver `thought_signature` (gemmes automatisk)
- System instruction guider modellen til visuel fortolkning (ikke literal tekst)
- Stilvalg: fotorealistisk (default), minimalistisk, skitse, filmisk

## Konfiguration

API keys læses fra `~/.env`:
- `OPENAI_API_KEY` - Whisper transskription
- `GEMINI_API_KEY_FREE` - Gemini (free tier, primær)
- `GEMINI_API_KEY` - Gemini (paid tier, fallback)

App-specifik config i `backend/.env`:
- `JWT_SECRET` - JWT signing key
- `DATABASE_URL` - SQLite path (default: data/lyd-til-tekst.db)

## Database

SQLite med tabeller:
- `users` - username, password_hash, email (optional)
- `sessions` - JWT token tracking
- `transcriptions` - raw_text, instruction, processed_text
- `style_guides` - Bruger-definerede stilguides
- `api_usage` - Cost tracking per bruger
- `image_generations` - Genererede billeder + multi-turn state

## Teknologi

- **Backend**: FastAPI, SQLAlchemy, bcrypt, python-jose
- **Frontend**: Astro, React, TailwindCSS
- **APIs**: OpenAI Whisper, Google Gemini 3 Flash (tekst), Gemini 3 Pro Image (billeder)
- **Auth**: JWT tokens i httpOnly cookies
