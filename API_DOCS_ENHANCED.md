# ICN API - Índice de Calidad Noticiosa

## Descripción

API REST que analiza artículos periodísticos usando IA (Claude) para evaluar:

- **Calidad Periodística** (40%) - Fuentes, verificabilidad, atribuciones
- **Calidad Narrativa** (25%) - Estructura, lead, coherencia
- **Cobertura Contextual** (25%) - Antecedentes, marco legal, perspectivas
- **Riesgo Editorial** (10%) - Carga opinativa, clickbait, polarización

## Instalación Local

```bash
git clone https://github.com/ycdb5cmmyn-maker/v52.git
cd v52
git checkout api-setup
npm install

# Crear .env.local
cp .env.example .env.local
# Editar con tu ANTHROPIC_API_KEY

# Ejecutar
npm run dev
```

API en: `http://localhost:3000`

## Endpoints

### POST /api/analyze

Analiza un artículo completo.

**Request:**
```json
{
  "texto": "Artículo completo aquí...",
  "tipo": "noticia"
}
```

**Tipos válidos:**
- noticia
- cronica
- analisis
- columna
- editorial
- entrevista

**Response (200):**
```json
{
  "success": true,
  "data": {
    "parrafos": [...],
    "scores": {
      "periodistico": { "score": 75, "justificacion": "...", "sub": {...} },
      "narrativo": { "score": 68, "justificacion": "...", "sub": {...} },
      "riesgo": { "score": 35, "justificacion": "...", "sub": {...} },
      "contextual": { "score": 82, "justificacion": "...", "faltantes": [...] }
    },
    "fuentes": {
      "tipos_detectados": [...],
      "diversidad": 75,
      "independencia": 68,
      "concentracion_oficial": 45
    },
    "tiempoCorreccion": 15,
    "fortalezas": [...],
    "problemasCriticos": [...],
    "veredicto": "...",
    "accionInmediata": "...",
    "timestamp": 1234567890
  },
  "timestamp": 1234567890
}
```

### GET /api/health

Verifica estado de la API.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "message": "API ICN operativa",
    "version": "1.0.0",
    "uptime": 3600000,
    "apiKey": "configured",
    "timestamp": 1234567890
  },
  "timestamp": 1234567890
}
```

## Ejemplos

### cURL
```bash
# Health check
curl https://api.example.com/api/health

# Análisis
curl -X POST https://api.example.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "texto": "El Banco Central anunció hoy nuevas medidas...",
    "tipo": "noticia"
  }'
```

### JavaScript/Node.js
```javascript
const response = await fetch('https://api.example.com/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texto: 'Artículo aquí...',
    tipo: 'noticia'
  })
});

const { data } = await response.json();
console.log('Score ICN:', data.scores);
```

### Python
```python
import requests

response = requests.post('https://api.example.com/api/analyze', json={
    'texto': 'Artículo aquí...',
    'tipo': 'noticia'
})

data = response.json()['data']
print(f"Score Periodístico: {data['scores']['periodistico']['score']}")
```

## Validaciones

- **Texto mínimo:** 100 caracteres
- **Texto máximo:** 50,000 caracteres
- **Tipo:** Debe ser válido (ver lista arriba)
- **Rate limit:** 60 requests/minuto por IP

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 200 | Análisis exitoso |
| 400 | Validación fallida (texto inválido/tipo desconocido) |
| 405 | Método no permitido |
| 429 | Rate limit excedido |
| 500 | Error del servidor |
| 503 | API Key no configurada |

## Características

✅ Análisis por párrafo con LLM  
✅ Caché en memoria (24 horas TTL)  
✅ Rate limiting por IP  
✅ CORS habilitado  
✅ Validación de entrada robusta  
✅ Logs estructurados  
✅ TypeScript types completos  
✅ Tests unitarios  

## Variables de Entorno

```env
ANTHROPIC_API_KEY=sk_ant_xxxxx
NODE_ENV=development
```

## Despliegue en Vercel

1. Push a GitHub
2. En Vercel: New Project → Seleccionar repo
3. Environment Variables → Agregar `ANTHROPIC_API_KEY`
4. Deploy automático ✅

## Estructura

```
.
├── pages/api/
│   ├── analyze.ts          # Endpoint principal
│   └── health.ts           # Health check
├── lib/
│   ├── analyzer.ts         # Lógica LLM
│   ├── types.ts            # TypeScript interfaces
│   ├── middleware.ts       # Rate limit, CORS
│   ├── validation.ts       # Validación entrada
│   └── cache.ts            # Caché en memoria
├── __tests__/              # Tests unitarios
├── .env.example            # Variables ejemplo
├── package.json            # Dependencias
├── tsconfig.json           # TypeScript config
├── next.config.js          # Next.js config
└── vercel.json             # Vercel config
```

## Próximos Pasos

- [ ] Base de datos para persistencia
- [ ] API keys por usuario
- [ ] Dashboard de uso/estadísticas
- [ ] Webhook para notificaciones
- [ ] OpenAPI/Swagger documentation
- [ ] Métricas con Prometheus

## Soporte

GitHub Issues: https://github.com/ycdb5cmmyn-maker/v52/issues

---

**Versión:** 1.0.0  
**Última actualización:** Junio 2026  
**Autor:** Florencia Márquez Bonino
