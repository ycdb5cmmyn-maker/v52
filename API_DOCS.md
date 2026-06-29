# ICN API - Índice de Calidad Noticiosa

API REST para análisis periodístico impulsado por inteligencia artificial. Evalúa artículos de noticias en múltiples dimensiones: calidad periodística, narrativa, riesgo editorial y contexto faltante.

## 🚀 Quick Start

### Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/ycdb5cmmyn-maker/v52.git
cd v52

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tu ANTHROPIC_API_KEY

# Ejecutar en desarrollo
npm run dev
```

La API estará disponible en `http://localhost:3000`

## 🌍 Despliegue en Vercel

### 1. Conectar repositorio
- Ir a [vercel.com](https://vercel.com)
- Click en "New Project"
- Seleccionar este repositorio

### 2. Configurar variables de entorno
En Vercel Dashboard → Settings → Environment Variables:

```
ANTHROPIC_API_KEY=sk_ant_xxxxxxxxxxxxx
```

### 3. Deploy
```bash
git push origin main
# Vercel desplegará automáticamente
```

Tu API estará en: `https://tu-proyecto.vercel.app`

## 📚 Documentación de Endpoints

### 1. Análisis Completo
**POST** `/api/analyze`

Ejecuta un análisis completo del texto con evaluación por párrafo, scores de calidad y veredicto editorial.

#### Request
```bash
curl -X POST https://tu-api.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "texto": "Lorem ipsum dolor sit amet...",
    "tipo": "noticia"
  }'
```

#### Request Body
| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `texto` | string | ✅ | Contenido del artículo (mín. 100 caracteres) |
| `tipo` | string | ✅ | Género: `noticia`, `cronica`, `analisis`, `columna`, `editorial`, `entrevista` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "parrafos": [
      {
        "txt": "Primer párrafo del texto...",
        "idx": 0,
        "sev": "ok",
        "problemas": [],
        "fortalezas": ["Estructura clara", "Fuentes citadas"]
      }
    ],
    "scores": {
      "periodistico": {
        "score": 75,
        "justificacion": "Buena verificación de fuentes",
        "evidencia": "Se citan 3 fuentes independientes",
        "recomendacion": "Añadir perspectiva de la sociedad civil"
      },
      "narrativo": {
        "score": 68,
        "justificacion": "Lead claro pero podría mejorar estructura"
      },
      "riesgo": {
        "score": 25,
        "justificacion": "Bajo riesgo editorial, lenguaje neutral"
      },
      "contextual": {
        "score": 70,
        "justificacion": "Buen contexto histórico",
        "faltantes": []
      }
    },
    "fuentes": {
      "tipos_detectados": [
        {"tipo": "oficial", "cantidad": 2, "ejemplos": ["Ministerio de Salud"]},
        {"tipo": "academica", "cantidad": 1, "ejemplos": ["Universidad de Buenos Aires"]}
      ],
      "diversidad": 75,
      "independencia": 80,
      "concentracion_oficial": 40
    },
    "tiempoCorreccion": 15,
    "razonTiempo": "Requiere revisión de atribuciones",
    "fortalezas": ["Múltiples perspectivas", "Datos verificables"],
    "problemasCriticos": [
      {
        "problema": "Falta perspectiva ciudadana",
        "gravedad": "media",
        "solucion": "Incluir testimonio de afectados"
      }
    ],
    "veredicto": "Artículo de buena calidad, publicable con revisión menor de contexto.",
    "accionInmediata": "Añadir voz de la ciudadanía antes de publicar",
    "tipo": "noticia",
    "timestamp": 1719693600000,
    "texto": "..."
  },
  "timestamp": 1719693600000
}
```

#### Error Responses
**400 Bad Request** - Entrada inválida
```json
{
  "success": false,
  "error": "El texto debe tener al menos 100 caracteres",
  "timestamp": 1719693600000
}
```

**405 Method Not Allowed**
```json
{
  "success": false,
  "error": "Método no permitido. Use POST.",
  "timestamp": 1719693600000
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Error al contactar con el servicio de IA",
  "timestamp": 1719693600000
}
```

### 2. Health Check
**GET** `/api/health`

Verifica el estado de la API y disponibilidad de recursos.

#### Request
```bash
curl https://tu-api.vercel.app/api/health
```

#### Response (200 OK)
```json
{
  "status": "ok",
  "message": "API ICN operativa",
  "timestamp": 1719693600000,
  "version": "1.0.0",
  "uptime": 3600000
}
```

#### Response (503 Service Unavailable)
```json
{
  "status": "error",
  "message": "Falta configuración de ANTHROPIC_API_KEY",
  "timestamp": 1719693600000,
  "version": "1.0.0",
  "uptime": 3600000
}
```

## 📊 Estructura de Scores

### Score Periodístico (40% del total)
Evalúa:
- Verificabilidad de afirmaciones
- Diversidad e independencia de fuentes
- Completitud de atribuciones
- Presencia de documentación

**Rango:** 0-100

### Score Narrativo (25% del total)
Evalúa:
- Estructura del lead
- Coherencia titular-cuerpo
- Jerarquía de información
- Claridad expositiva

**Rango:** 0-100

### Score Riesgo Editorial (10% del total, invertido)
Detecta:
- Carga opinativa no atribuida
- Polarización lingüística
- Clickbait
- Dependencia excesiva de fuentes oficiales

**Rango:** 0-100 (invertido: 0 = alto riesgo, 100 = bajo riesgo)

### Cobertura Contextual (25% del total)
Identifica dimensiones ausentes:
- Antecedentes históricos
- Marco legal/institucional
- Datos económicos
- Perspectiva ciudadana
- Actores afectados

**Rango:** 0-100

### Score Agregado (ICN)
```
ICN = (Periodístico × 0.40) + (Narrativo × 0.25) + (Contextual × 0.25) + ((100 - Riesgo) × 0.10)
```

**Semáforo:**
- 🟢 **Publicable** (≥68): Apto para publicar
- 🟡 **Revisar** (45-67): Requiere cambios menores
- 🔴 **Crítico** (<45): No publicar sin correcciones

## 🔐 Seguridad

### API Key
La clave de Anthropic se configura via variable de entorno `ANTHROPIC_API_KEY` y nunca se expone en el cliente.

### Rate Limiting
- Máximo 60 análisis por minuto
- Máximo 5,000 análisis por día
- Timeout: 5 minutos por solicitud

### CORS
Para usar desde cliente web, configura CORS en tu aplicación frontend.

## 📦 Ejemplos de Uso

### JavaScript/TypeScript
```typescript
const response = await fetch('https://tu-api.vercel.app/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texto: "El artículo que quiero analizar...",
    tipo: "noticia"
  })
});

const { data, success } = await response.json();

if (success) {
  console.log(`Score ICN: ${data.scores.periodistico.score}`);
  console.log(`Veredicto: ${data.veredicto}`);
}
```

### Python
```python
import requests
import json

url = 'https://tu-api.vercel.app/api/analyze'
payload = {
    'texto': 'El artículo que quiero analizar...',
    'tipo': 'noticia'
}

response = requests.post(url, json=payload)
data = response.json()

if data['success']:
    print(f"Score: {data['data']['scores']['periodistico']['score']}")
    print(f"Veredicto: {data['data']['veredicto']}")
```

### cURL
```bash
curl -X POST https://tu-api.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"texto":"Contenido aquí...","tipo":"noticia"}' \
  | jq '.data.veredicto'
```

## 🛠️ Desarrollo Local

### Estructura del Proyecto
```
v52/
├── pages/
│   └── api/
│       ├── analyze.ts      # Endpoint principal de análisis
│       └── health.ts       # Health check
├── lib/
│   ├── analyzer.ts         # Lógica de análisis
│   ├── llm.ts             # Integración con Claude
│   └── types.ts           # Tipos TypeScript
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json
└── .env.example
```

### Variables de Entorno
```bash
# .env.local
ANTHROPIC_API_KEY=sk_ant_xxxxx
NODE_ENV=development
```

### Scripts
```bash
npm run dev        # Desarrollar localmente
npm run build      # Compilar para producción
npm start          # Ejecutar en producción
npm run type-check # Verificar tipos TypeScript
npm run lint       # Linter
```

## 📈 Monitoreo

### Vercel Analytics
- Dashboard de Vercel muestra métricas de rendimiento
- Logs en Vercel → Project → Deployments → Logs

### Errores Comunes

**Error: "ANTHROPIC_API_KEY not found"**
```
Solución: Configurar ANTHROPIC_API_KEY en Vercel Environment Variables
```

**Error: "Timeout after 300s"**
```
Solución: Texto muy largo o modelo lento. Máx. 10,000 caracteres recomendado.
```

**Error: "Rate limit exceeded"**
```
Solución: Esperar o contactar al administrador para aumentar límites.
```

## 🔄 Roadmap

- [ ] Análisis por párrafo endpoint separado
- [ ] Historial de análisis con persistencia
- [ ] Autenticación y API keys por usuario
- [ ] Caché de resultados
- [ ] Webhooks para notificaciones
- [ ] Exportación a PDF/CSV
- [ ] Dashboard de métricas

## 📄 Licencia

Proyecto académico - Universidad de San Andrés

## 👨‍💼 Autor

**Florencia Márquez Bonino**  
Maestría en Periodismo, UdeSA

## 💬 Soporte

Para reportar bugs o sugerencias:
- GitHub Issues: https://github.com/ycdb5cmmyn-maker/v52/issues
- Email: contacto@icn-api.dev

---

**Última actualización:** Junio 2026  
**Versión API:** 1.0.0
