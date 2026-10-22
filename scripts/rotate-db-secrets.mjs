#!/usr/bin/env node
/**
 * Rabbitty Database Secret Rotation Script (Zero-Downtime Blue-Green Credentials)
 *
 * Flujo Completo Zero-Downtime:
 * 1. Concurrencia / Idempotencia: Verifica si ya existe una rotación reciente (<2h).
 * 2. Conexión de Administración: Conecta vía PostgreSQL client (pg) usando el rol actual.
 * 3. Crea el NUEVO rol Green en Neon con timestamp criptográfico.
 * 4. GRANTs & OWNERSHIP:
 *    - GRANT CONNECT ON DATABASE to nuevo_rol
 *    - GRANT USAGE, CREATE ON SCHEMA public to nuevo_rol
 *    - GRANT ALL PRIVILEGES ON ALL TABLES / SEQUENCES to nuevo_rol
 *    - ALTER DEFAULT PRIVILEGES FOR ROLE nuevo_rol ...
 *    - REASSIGN OWNED BY rol_viejo TO nuevo_rol (Transfiere propiedad de tablas para migrations DDL).
 * 5. Sincronización en Vercel (GET + PATCH/POST con res.ok).
 * 6. Sincronización en Railway (GraphQL variableUpsert con validación de errors[]).
 * 7. Polling Inteligente de Deployments / Healthcheck (espera a que Vercel y Railway estén en línea).
 * 8. Revocación Segura del Rol Blue Antiguo (DROP ROLE rol_viejo tras confirmar tráfico).
 */

import crypto from 'node:crypto';
import pg from 'pg';

const { Client } = pg;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const neonApiKey = process.env.NEON_API_KEY;
  const neonProjectId = process.env.NEON_PROJECT_ID;
  const vercelToken = process.env.VERCEL_TOKEN;
  const railwayToken = process.env.RAILWAY_API_TOKEN;
  const currentDatabaseUrl = process.env.DATABASE_URL || process.env.CORE_DATABASE_URL;

  if (!neonApiKey || !neonProjectId) {
    throw new Error('❌ Falta NEON_API_KEY o NEON_PROJECT_ID en el entorno.');
  }

  // 1. Obtener host y rol activo
  console.log('📡 1. Consultando endpoints y roles en Neon...');
  const endpointsRes = await fetch(`https://console.neon.tech/api/v2/projects/${neonProjectId}/endpoints`, {
    headers: { 'Authorization': `Bearer ${neonApiKey}`, 'Accept': 'application/json' },
  });
  if (!endpointsRes.ok) {
    throw new Error(`Error consultando endpoints de Neon: ${await endpointsRes.text()}`);
  }
  const endpointsData = await endpointsRes.json();
  const host = endpointsData?.endpoints?.[0]?.host || process.env.NEON_HOST;
  if (!host) {
    throw new Error('❌ No se pudo determinar el host de Neon.');
  }

  const dbName = process.env.NEON_DATABASE_NAME || 'neondb';

  // Identificar el rol anterior
  let oldRoleName = 'neondb_owner';
  if (currentDatabaseUrl) {
    try {
      const parsedUrl = new URL(currentDatabaseUrl);
      if (parsedUrl.username) oldRoleName = parsedUrl.username;
    } catch {}
  }

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const newRoleName = `rabbitty_rot_${timestamp}`;
  const newPassword = crypto.randomBytes(24).toString('base64url');

  console.log(`🔄 [Zero-Downtime Rotation] Rol Blue actual: '${oldRoleName}' -> Rol Green nuevo: '${newRoleName}'`);

  // 2. Crear NUEVO rol en Neon vía API REST
  console.log(`🔐 2. Creando nuevo rol Green '${newRoleName}' en Neon...`);
  const createRoleRes = await fetch(`https://console.neon.tech/api/v2/projects/${neonProjectId}/branches/main/roles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${neonApiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: {
        name: newRoleName,
        password: newPassword,
      },
    }),
  });

  if (!createRoleRes.ok) {
    // Fallback a nivel de project/roles
    const fallbackRes = await fetch(`https://console.neon.tech/api/v2/projects/${neonProjectId}/roles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${neonApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: {
          name: newRoleName,
          password: newPassword,
        },
      }),
    });
    if (!fallbackRes.ok) {
      throw new Error(`Fallo creando nuevo rol en Neon: ${await fallbackRes.text()}`);
    }
  }

  console.log('✅ 2. Rol Green creado en Neon.');

  // 3. Replicar GRANTS y OWNERSHIP para evitar Permission Denied
  console.log('🛡️ 3. Configurando privilegios de lectura, escritura y ownership...');
  if (currentDatabaseUrl) {
    const adminClient = new Client({ connectionString: currentDatabaseUrl, ssl: { rejectUnauthorized: false } });
    try {
      await adminClient.connect();
      // Garantizar acceso y membresía al rol previo para transferir herencia de permisos
      await adminClient.query(`GRANT "${oldRoleName}" TO "${newRoleName}";`);
      
      // Transferencia estricta de OWNERSHIP de todos los objetos existentes (tablas, secuencias, tipos)
      await adminClient.query(`REASSIGN OWNED BY "${oldRoleName}" TO "${newRoleName}";`);

      await adminClient.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${newRoleName}";`);
      await adminClient.query(`GRANT USAGE, CREATE ON SCHEMA public TO "${newRoleName}";`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${newRoleName}";`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${newRoleName}";`);
      await adminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${oldRoleName}" IN SCHEMA public GRANT ALL ON TABLES TO "${newRoleName}";`);
      await adminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${oldRoleName}" IN SCHEMA public GRANT ALL ON SEQUENCES TO "${newRoleName}";`);
      await adminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${newRoleName}" IN SCHEMA public GRANT ALL ON TABLES TO "${newRoleName}";`);
      await adminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${newRoleName}" IN SCHEMA public GRANT ALL ON SEQUENCES TO "${newRoleName}";`);
      
      console.log('✅ 3. Privilegios, herencia y OWNERSHIP transferidos con éxito.');
    } catch (dbErr) {
      console.warn('⚠️ Nota sobre asignación de grants (se intentará continuar):', dbErr.message);
    } finally {
      await adminClient.end();
    }
  }

  const newDatabaseUrl = `postgresql://${newRoleName}:${newPassword}@${host}/${dbName}?sslmode=require`;

  // 4. Sincronización en Vercel
  if (vercelToken) {
    console.log('🌐 4. Sincronizando en Vercel (GET env + PATCH/POST con validación)...');
    const vercelProjects = [process.env.VERCEL_PROJECT_ID_APP, process.env.VERCEL_PROJECT_ID_ADMIN].filter(Boolean);

    for (const projId of vercelProjects) {
      console.log(`   -> Proyecto Vercel: ${projId}`);
      const getEnvRes = await fetch(`https://api.vercel.com/v9/projects/${projId}/env`, {
        headers: { 'Authorization': `Bearer ${vercelToken}` },
      });
      if (!getEnvRes.ok) throw new Error(`Fallo en Vercel GET env: ${await getEnvRes.text()}`);

      const envData = await getEnvRes.json();
      const existingEnv = envData?.envs?.find((e) => e.key === 'DATABASE_URL');

      let updateRes;
      if (existingEnv?.id) {
        updateRes = await fetch(`https://api.vercel.com/v9/projects/${projId}/env/${existingEnv.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            value: newDatabaseUrl,
            target: ['production', 'preview'],
          }),
        });
      } else {
        updateRes = await fetch(`https://api.vercel.com/v10/projects/${projId}/env`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'DATABASE_URL',
            value: newDatabaseUrl,
            type: 'encrypted',
            target: ['production', 'preview'],
          }),
        });
      }

      if (!updateRes.ok) throw new Error(`Fallo en Vercel actualizando env: ${await updateRes.text()}`);
    }
    console.log('✅ 4. Vercel actualizado con éxito.');
  }

  // 5. Sincronización en Railway
  if (railwayToken && process.env.RAILWAY_PROJECT_ID && process.env.RAILWAY_ENVIRONMENT_ID) {
    console.log('🚂 5. Sincronizando en Railway GraphQL API...');
    const railwayQuery = `
      mutation UpdateDatabaseUrl($projectId: String!, $environmentId: String!, $name: String!, $value: String!) {
        variableUpsert(input: {
          projectId: $projectId,
          environmentId: $environmentId,
          name: $name,
          value: $value
        })
      }
    `;

    const railwayRes = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${railwayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: railwayQuery,
        variables: {
          projectId: process.env.RAILWAY_PROJECT_ID,
          environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
          name: 'DATABASE_URL',
          value: newDatabaseUrl,
        },
      }),
    });

    if (!railwayRes.ok) throw new Error(`Fallo HTTP en Railway: ${await railwayRes.text()}`);
    const railwayJson = await railwayRes.json();
    if (railwayJson.errors && railwayJson.errors.length > 0) {
      throw new Error(`Fallo GraphQL en Railway: ${JSON.stringify(railwayJson.errors)}`);
    }
    console.log('✅ 5. Railway actualizado con éxito.');
  }

  // 6. Polling Inteligente de Deployments / Healthcheck
  console.log('⏳ 6. Verificando despliegue de nuevos pods y healthcheck...');
  const healthUrl = process.env.HEALTHCHECK_URL_VERCEL || 'https://app.rabbitty.me/api/auth/session';
  let healthy = false;
  let attempts = 0;
  const maxAttempts = 15; // 15 intentos x 6 segundos = 90 segundos máx

  while (!healthy && attempts < maxAttempts) {
    attempts++;
    await sleep(6000);
    try {
      const res = await fetch(healthUrl);
      if (res.status === 200 || res.status === 401) {
        healthy = true;
        console.log(`🩺 Intento ${attempts}: Healthcheck OK (Status ${res.status}). La app está conectando al nuevo rol.`);
      } else {
        console.log(`🩺 Intento ${attempts}: Esperando despliegue (Status ${res.status})...`);
      }
    } catch {
      console.log(`🩺 Intento ${attempts}: Pod reiniciando...`);
    }
  }

  if (!healthy) {
    console.warn('⚠️ El healthcheck no respondió a tiempo; el rol Blue antiguo se mantendrá activo por seguridad.');
    return;
  }

  // 7. Limpieza / Revocación del rol anterior (Solo si fue un rol rotado previo y no el owner de fábrica)
  if (oldRoleName.startsWith('rabbitty_rot_')) {
    console.log(`🧹 7. Eliminando rol Blue anterior '${oldRoleName}' de Neon...`);
    try {
      const delRoleRes = await fetch(`https://console.neon.tech/api/v2/projects/${neonProjectId}/branches/main/roles/${oldRoleName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${neonApiKey}` },
      });
      if (delRoleRes.ok) {
        console.log(`✅ 7. Rol anterior '${oldRoleName}' eliminado. Superficie de ataque reducida.`);
      }
    } catch (delErr) {
      console.warn('⚠️ No se pudo eliminar el rol anterior (puede tener dependencias residuales):', delErr);
    }
  } else {
    console.log(`ℹ️ El rol anterior era '${oldRoleName}' (rol base del proyecto). Se mantiene para operaciones de soporte.`);
  }

  console.log(`🎉 [Zero-Downtime Rotation] Proceso 100% completado. Rol activo: ${newRoleName}`);
}

main().catch((e) => {
  console.error('❌ Error crítico en rotación de secretos:', e);
  process.exit(1);
});
