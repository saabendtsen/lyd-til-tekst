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

## Teknologi

- **Backend**: FastAPI, SQLAlchemy, bcrypt, python-jose
- **Frontend**: Astro, React, TailwindCSS
- **APIs**: OpenAI Whisper, Google Gemini (dual-tier)
- **Auth**: JWT tokens i httpOnly cookies
