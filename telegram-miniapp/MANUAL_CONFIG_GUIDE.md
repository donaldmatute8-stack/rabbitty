# Guía de Configuración Manual para Producción (Rabbitty)

Este documento detalla los pasos que el administrador o dueño del proyecto debe realizar fuera del código (en plataformas de terceros) para habilitar funcionalidades clave en Producción.

## 1. Configurar "Foursquare Claim" (Google My Business / OAuth)
Para habilitar que los dueños de negocios auto-aprueben su identidad iniciando sesión con Google:

1. Ve a **Google Cloud Console** (https://console.cloud.google.com).
2. Crea un nuevo proyecto llamado `Rabbitty`.
3. Navega a **APIs & Services > OAuth consent screen** y configura la pantalla (Nombre, Logo, Dominio).
4. Navega a **Credentials > Create Credentials > OAuth client ID**.
5. Tipo de Aplicación: **Web application**.
6. Orígenes de JS Autorizados: El dominio de tu frontend en producción (ej. `https://rabbitty.com`).
7. URIs de redireccionamiento autorizados: `https://rabbitty.com/api/auth/callback/google` (Si usas NextAuth).
8. Copia el **Client ID** y **Client Secret** generados y colócalos en tu archivo `.env.production` (actualmente estamos usando un *mock* visual en `BusinessSetupForm.tsx`, este paso es para cuando conectemos el backend real de OAuth).

## 2. Configurar Bot de Telegram para Producción
El Mini App actualmente usa variables de entorno genéricas.
1. Habla con `@BotFather` en Telegram.
2. Crea un nuevo bot o edita el actual.
3. Configura el **Web App URL** del bot para que apunte al dominio final en producción (ej. `https://rabbitty.app`).
4. Obtén el **Bot Token** y guárdalo seguro en el `.env` del backend (necesario para validar el `initData` de forma criptográficamente segura en `/api/auth/...`).

## 3. Base de Datos en Producción
Actualmente estamos usando `dev.db` (SQLite local) para cero-configuración.
1. En producción, necesitas una base de datos PostgreSQL (ej. Supabase, Vercel Postgres, Neon).
2. Cambia la variable `DATABASE_URL` en tu `.env` a la conexión de Postgres.
3. Corre `npx prisma db push` o `npx prisma migrate deploy` en el servidor de producción.
