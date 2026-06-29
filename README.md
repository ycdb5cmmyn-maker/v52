# ICN API - Setup Completo

✅ **API REST lista para desplegar en Vercel**

## 📋 Contenido de esta rama

Esta rama `api-setup` contiene la configuración completa de la API con:

- ✅ Next.js configurado
- ✅ Integración con Claude (Anthropic API)
- ✅ Endpoint `/api/analyze` - análisis completo de artículos
- ✅ Endpoint `/api/health` - verificación de estado
- ✅ TypeScript types definidos
- ✅ Documentación completa en `API_DOCS.md`
- ✅ Configuración Vercel lista

## 🚀 Despliegue en Vercel (3 pasos)

### Paso 1: Conectar repo en Vercel

1. Ir a https://vercel.com/dashboard
2. Click "New Project"
3. Seleccionar repositorio `v52`
4. Seleccionar rama `api-setup`

### Paso 2: Configurar variable de entorno

En Vercel Dashboard:
1. Settings → Environment Variables
2. Agregar nueva variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** Tu clave de Anthropic (de https://console.anthropic.com/)

### Paso 3: Deploy

Vercel desplegará automáticamente. Tu API estará en:
```
https://v52-XXX.vercel.app
```

## 🧪 Probar la API

Una vez desplegada:

```bash
# Health check
curl https://v52-XXX.vercel.app/api/health

# Análisis de un artículo
curl -X POST https://v52-XXX.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "texto": "El Banco Central anunció hoy nuevas medidas...",
    "tipo": "noticia"
  }'
```

## 📚 Documentación

Ver `API_DOCS.md` para:
- Especificación completa de endpoints
- Ejemplos en JavaScript, Python y cURL
- Estructura de scores
- Guía de desarrollo local

## 📁 Estructura de archivos

```
api-setup/
├── pages/api/
│   ├── analyze.ts      ← Endpoint principal
│   └── health.ts       ← Health check
├── lib/
│   ├── analyzer.ts     ← Lógica de análisis
│   ├── llm.ts          ← Integración Claude
│   └── types.ts        ← TypeScript interfaces
├── package.json        ← Dependencias
├── tsconfig.json       ← Config TypeScript
├── next.config.js      ← Config Next.js
├── vercel.json         ← Config Vercel
├── .env.example        ← Variables de entorno
└── API_DOCS.md         ← Documentación completa
```

## 🛠️ Desarrollo local

```bash
# Clonar y configurar
git clone https://github.com/ycdb5cmmyn-maker/v52.git
cd v52
git checkout api-setup
npm install

# Crear .env.local con tu ANTHROPIC_API_KEY
cp .env.example .env.local
# Editar .env.local

# Ejecutar localmente
npm run dev
# API en http://localhost:3000
```

## 🔑 Obtener ANTHROPIC_API_KEY

1. Ir a https://console.anthropic.com/
2. Crear cuenta o iniciar sesión
3. API Keys → Create New Key
4. Copiar la clave `sk_ant_...`
5. Guardar en Vercel → Environment Variables

## 📊 Scores de Análisis

La API evalúa artículos en 4 dimensiones:

| Dimension | Peso | Qué mide |
|-----------|------|----------|
| **Periodístico** | 40% | Verificabilidad, fuentes, atribuciones |
| **Narrativo** | 25% | Estructura, lead, jerarquía |
| **Riesgo** | 10% | Carga opinativa, clickbait, polarización |
| **Contextual** | 25% | Antecedentes, marco legal, perspectivas |

**Score ICN** (0-100):
- 🟢 **≥68**: Publicable
- 🟡 **45-67**: Requiere revisión
- 🔴 **<45**: Crítico

## 📈 Próximos pasos

- [ ] Integrar con dashboard frontend
- [ ] Agregar autenticación y API keys por usuario
- [ ] Persistencia de resultados
- [ ] Webhooks para notificaciones
- [ ] Caché de análisis

## 💬 Soporte

Dudas o problemas:
- Revisar `API_DOCS.md`
- GitHub Issues: https://github.com/ycdb5cmmyn-maker/v52/issues
- Logs en Vercel: Dashboard → Deployments → Logs

---

**¡API lista para producción! 🚀**

Última actualización: Junio 2026
