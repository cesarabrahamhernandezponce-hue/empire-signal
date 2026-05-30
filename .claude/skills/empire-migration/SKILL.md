---
name: empire-migration
description: Guía a Claude Code durante la migración y construcción de Empire Signal desde Spring Boot (~/empire-signal) hacia Next.js 15. Define reglas de migración, principios de producto, decisiones de arquitectura y nivel de autonomía operacional.
---

# Empire Signal — Migración y Construcción

## Contexto del proyecto

Empire Signal es una app de análisis lingüístico con IA construida por César, fundador solo desde Cuba. La visión es convertirla en un ecosistema de apps educativas bajo la marca Empire (Empire Translate, Biblioteca de Alejandría, Empire Recruit, etc.).

El proyecto viejo en Spring Boot 3.5 / Java 21 está en `~/empire-signal`. Funciona correctamente y se usa como referencia de lógica de negocio. **Nunca modifiques archivos del proyecto viejo.** Es solo lectura.

El proyecto nuevo (este) es Next.js 15 con App Router, TypeScript estricto, Tailwind 3, Prisma, Supabase. La migración preserva la lógica de producto pero moderniza la arquitectura.

## Principios de producto (NO NEGOCIABLES)

Decididos basándose en investigación de mercado sobre qué odian los usuarios de apps de IA y diccionarios en 2026.

### 1. Transparencia radical sobre la IA
Los usuarios desconfían de la IA pero la usan. Empire es explícito y honesto: cada análisis muestra que fue generado por IA y permite reportar errores. Cero pretensiones de magia o infalibilidad.

### 2. UX radicalmente limpio
Cero ads. Cero notificaciones invasivas. Cero pop-ups de upgrade. Cero dark patterns. Información progresiva: vista esencial primero, expandida bajo demanda. Mobile-first.

### 3. Respeto al usuario
Copy adulta, no infantil. Sin emojis innecesarios. Gamificación sofisticada, no pasivo-agresiva. Límites de uso respetuosos.

### 4. Profundidad real, no superficialidad gamificada
Duolingo crea "principiantes confiados". Empire ataca lo opuesto: profundidad real. Las 13 secciones son la ventaja competitiva. Ejercicios productivos (escribir, usar), no decorativos.

### 5. Progreso visible desde el día uno
Dashboard simple con estadísticas reales desde Fase 1. Historial personal accesible y útil.

### 6. Foso defensivo a través de datos propietarios
La estrategia no es la mejor IA, es la mejor data. Cada búsqueda se registra (SearchEvent). En Fase 2-3 se construye sistema crowdsourced de palabras regionales latinoamericanas.

## Stack definido (no cambiar sin consultar)

- **Framework:** Next.js 15 con App Router y Turbopack
- **Lenguaje:** TypeScript estricto
- **Estilos:** Tailwind CSS 3.4 (NO Tailwind 4, da problemas con lightningcss en Linux)
- **Base de datos:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Auth:** Supabase Auth (no NextAuth, no Clerk)
- **Validación:** Zod
- **IA (desarrollo y Fase 1):** Google Gemini 2.5 Flash vía SDK `@google/genai` (tier gratuito, 1,500 req/día)
- **IA (futuro, Fase 2-3):** Posible cambio a OpenRouter+DeepSeek o modelo propio cuando se necesite proteger data propietaria (Google usa prompts del tier gratuito para entrenar)
- **Pagos:** Lemon Squeezy (Fase 1 tardía, no implementar todavía)
- **Hosting:** Vercel

## CRÍTICO: SDK de Gemini

**Usa el SDK NUEVO: `@google/genai`** (versión 2.x+).

**NUNCA uses `@google/generative-ai`** — está DEPRECADO por Google desde Gemini 2.0. Tu conocimiento de entrenamiento puede sugerir el SDK viejo porque es más común en ejemplos antiguos. NO lo hagas. Verifica siempre que el import sea de `@google/genai`.

Sintaxis correcta del SDK nuevo:
```typescript
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
});
```

La variable de entorno es `GEMINI_API_KEY` en `.env.local`.

## Decisiones de arquitectura tomadas

### Abstracción del proveedor de IA
El cliente de IA debe estar abstraído en `src/lib/ai/client.ts` con una función única (ej. `generateAnalysis(prompt)`) que el resto de la app usa sin saber qué proveedor hay detrás. Hoy es Gemini. Mañana puede ser DeepSeek o modelo propio. Cambiar de proveedor debe ser modificar solo este archivo, nunca la lógica de servicio.

### Modelo de datos del análisis

El análisis se guarda como JSON estructurado con versionado, no como string crudo.

- Campo `analysisJson` tipo `Json` en Prisma.
- Estructura con `version: 1`, `essential` (6 secciones), `advanced` (7 secciones).
- Validado con Zod.
- Claves del JSON siempre en inglés (camelCase), contenido en el idioma del usuario.

### Las 13 secciones del análisis

**Esenciales (siempre visibles):**
1. meaningInContext
2. wordType (category + explanation)
3. pronunciation (phonetic + guide)
4. usageExamples (3: formal/technical/everyday)
5. collocations (5, diferenciador único)
6. mnemonic (diferenciador único)

**Avanzadas (expandibles):**
7. etymology
8. story
9. synonyms (4 con matices)
10. antonyms (3 con contexto)
11. registerLevel (level + guidance)
12. commonErrors (diferenciador único)
13. wordFamily (4 derivaciones, diferenciador único)

### Caché global
Caché global, no por usuario. `@@unique([word, context, tone, language])`. Si dos usuarios buscan lo mismo, se reutiliza el análisis. Ahorra costos de IA.

### Modelo de uso
Modo público en Fase 1 (sin login obligatorio). Login obligatorio en Fase 2. Tabla User existe desde Fase 1 pero no es obligatoria.

### Prompts
Los prompts son producto, no código. Viven en `src/lib/ai/prompts/` como constantes exportadas. Versión español e inglés SEPARADAS (no interpoladas). Cuando uno cambie, actualizar el otro en simetría.

### Tablas de base de datos (8 totales, YA CREADAS en Supabase)

1. **users** — usuarios con plan FREE/PRO, contadores de uso
2. **search_records** — caché global con JSON estructurado
3. **user_search_history** — relación usuario-búsqueda
4. **follow_up_questions** — preguntas de seguimiento privadas
5. **subscriptions** — placeholder Lemon Squeezy
6. **search_events** — cada búsqueda individual (analytics)
7. **bookmarks** — favoritos con folders y notas
8. **word_of_the_day** — palabra del día (lógica en Fase 2)

**NOTA:** La base de datos ya está migrada y funcional. El comando `prisma migrate status` falla desde la red de César (Cuba) por handshake con el pooler, pero esto NO afecta el desarrollo. El cliente `@prisma/client` funciona por puerto 6543. Para ver tablas, usar Table Editor de Supabase, no `migrate status`.

## Reglas de migración Spring → Next.js

### Mapeo conceptual

- `@RestController` → API Route en `src/app/api/.../route.ts`
- `@Service` → función en `src/lib/services/`
- `JpaRepository` → cliente Prisma en `src/lib/db/`
- `@Entity` → modelo en `prisma/schema.prisma`
- `application.properties` → variables en `.env.local`
- Spring Security → middleware Next.js + Supabase Auth

### Reglas específicas

1. **No traducir línea por línea.** Entiende qué hace el código viejo, escribe versión idiomática en TypeScript.
2. **El prompt de IA es producto.** Va en `src/lib/ai/prompts/`, cada uno en su archivo.
3. **Preservar el caché.** Misma palabra+contexto+tono+idioma reutiliza análisis.
4. **Auth cambia de paradigma.** No replicar Spring Security, adoptar modelo Supabase (JWT en cookies httpOnly).
5. **Revisar deuda técnica antes de migrar.** No copiar campos legacy.
6. **Naming:** camelCase variables/funciones, PascalCase tipos/componentes, kebab-case archivos. Campos Prisma camelCase con `@map` si la columna es snake_case.
7. **Errores tipados.** El código viejo retorna strings como "Error processing AI response" mezclados con análisis reales. Usar tipos discriminados (Result/Error), nunca exponer errores crudos al usuario.
8. **Timeout y reintento.** El código viejo no tiene timeout. Usar AbortController con 30s y reintento exponencial hasta 2 veces.
9. **Zod en cada borde.** Entrada de usuario, respuesta de IA, datos de caché — todo validado.
10. **Abstracción del proveedor de IA.** Cambiar de modelo debe ser una línea (ver sección de arquitectura).

## Estructura de carpetas

```
src/
├── app/
│   ├── api/
│   │   └── signal/
│   │       ├── analyze/route.ts
│   │       ├── ask/route.ts
│   │       └── ...
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
│   ├── ai/
│   │   ├── client.ts          # Abstracción del proveedor (Gemini)
│   │   ├── prompts/
│   │   │   ├── analyze-es.ts
│   │   │   ├── analyze-en.ts
│   │   │   └── ...
│   │   └── schemas/           # Validación Zod de respuestas IA
│   ├── db/                    # Cliente Prisma
│   ├── auth/                  # Helpers Supabase
│   ├── services/              # Lógica de negocio
│   └── utils/
└── types/
```

Crear subcarpetas conforme se necesiten.

## Reglas operacionales (nivel: equilibrado)

### Puedes ejecutar sin confirmar

- Crear archivos nuevos siguiendo la estructura.
- Migrar archivos individuales del proyecto viejo.
- Refactorizar código que tú mismo escribiste recientemente.
- Instalar dependencias del stack definido.
- Correr `npm run dev`, `npx prisma generate`, `npx prisma migrate dev`.
- Modificar `src/lib/`, `src/components/`, `src/app/`.
- Actualizar `prisma/schema.prisma` según cambios discutidos.

### DEBES consultar antes de hacer

- Instalar librerías nuevas no listadas en el stack.
- Cambiar la estructura de carpetas.
- Modificar el esquema de Prisma de formas que rompan migraciones.
- Decisiones de arquitectura (server vs client component cuando no es obvio).
- Renombrar archivos o carpetas existentes.
- Modificar configs: `next.config.ts`, `tsconfig.json`, `tailwind.config.js`, `package.json`.
- Comandos que borren archivos o hagan rollback.
- Implementar features no discutidas recientemente.
- Diseñar UI sin referencia visual previa.

### NUNCA hagas

- Modificar archivos en `~/empire-signal/` (proyecto viejo, solo lectura).
- Usar el SDK deprecado `@google/generative-ai` (usar `@google/genai`).
- Inventar variables de entorno sin documentarlas.
- Hardcodear API keys o secretos.
- Implementar Lemon Squeezy todavía.
- Crear componentes UI sin solicitud explícita.
- "Mejorar" código que funciona sin que se pida.
- Agregar gamificación, notificaciones, ads o dark patterns (viola Principios de producto).
- Usar emojis en copy de UI sin que César los pida.

## Cómo trabajar con el proyecto viejo

Cuando César pida migrar un archivo de Spring Boot:

1. Lee el archivo en `~/empire-signal/` con `view`.
2. Identifica qué hace conceptualmente.
3. Pregunta si hay decisiones del código viejo que quiere cambiar.
4. Propón la versión Next.js antes de escribirla.
5. Espera confirmación o ejecuta según el alcance.

Si encuentras lógica confusa (ej: variable `app.groq.api-key` que es de OpenRouter), señálalo antes de propagar el error.

## Contexto del fundador

- César aprende Node/TypeScript activamente. Explica decisiones no obvias en términos simples.
- Está en Cuba con conexión inestable. Evita descargas grandes innecesarias. Comandos de red pueden fallar (ej: `prisma migrate status`).
- Trabaja en paralelo con Claude conversacional para decisiones estratégicas. Si una decisión es arquitectónica grande, sugiere consultarlo.
- Migración objetivo: 6-8 semanas. Optimiza velocidad de iteración sin sacrificar calidad estructural.
- César planea irse de Cuba. Es fundador serio, no hobbyista.
- César no está conforme con el diseño actual. Cuando se llegue a UI, NO improvisar — esperar referencias visuales que aporte.

## Decisiones técnicas y por qué

- **Tailwind 3 no 4:** bug con lightningcss en Linux Ubuntu.
- **Supabase no auth propia:** reduce complejidad, da auth + BD + storage.
- **Prisma no Drizzle:** mejor DX para principiantes.
- **App Router no Pages:** Next.js 15 es App Router-first.
- **JSON estructurado no texto crudo:** permite vista esencial/expandida, evolución.
- **Caché global no por usuario:** ahorra costos.
- **Gemini gratis para desarrollo:** evita costos mientras César no puede pagar; 1,500 req/día sobran. Migrar a otro proveedor en Fase 2-3 para proteger data.
- **SDK `@google/genai` no `@google/generative-ai`:** el segundo está deprecado.
- **Lemon Squeezy no Stripe directo:** César opera desde Cuba con tarjeta americana de su padre. Merchant of Record evita problemas regulatorios.

## Al iniciar cada sesión

1. Verifica que el proyecto compila con `npm run dev`.
2. Si tocas Prisma, verifica el estado primero (vía Table Editor de Supabase, no `migrate status`).
3. Si la petición no está clara, pide especificidad.
4. Si algo podría violar un Principio de producto, señálalo antes de actuar.
