# Anotados · Arboleda

Vista de solo lectura de quiénes están anotados para almorzar y cenar, desde ayer hasta 7 días adelante.
Lee la misma base Neon que Limos (tabla `inscripciones`) y no escribe nada ni crea tablas.

## Deploy en Vercel

1. Crear un proyecto nuevo en Vercel apuntando a esta carpeta/repo (Framework preset: **Other**, sin build command).
2. En *Settings → Environment Variables* cargar `DATABASE_URL` con la misma connection string de Neon que usa Limos.
   Recomendado: crear en Neon un rol de solo lectura y usar su connection string.
3. Deploy.

Desde la CLI:

```powershell
vercel login
vercel link
vercel env add DATABASE_URL production
vercel --prod
```

## Local

```powershell
npm install
vercel dev
```
