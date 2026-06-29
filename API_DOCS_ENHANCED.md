# API Docs (Enhanced)

## Endpoints

### POST /api/analyze
Request body:
```json
{
  "text": "...",
  "type": "noticia"
}
```

Rules:
- text length: 100 to 50,000 chars
- type: noticia | cronica | entrevista | editorial | investigacion | opinion | otro

Response includes:
- score (0-100)
- weighted dimensions (periodistico, narrativo, contextual, riesgo)
- executive summary
- paragraph findings
- cached flag

### GET /api/health
Returns API status and whether `ANTHROPIC_API_KEY` is configured.

## Production behavior
- Rate limit: 60 requests/min per IP
- CORS headers enabled for frontend calls
- In-memory cache TTL: 24h
- Graceful fallback if LLM call fails
