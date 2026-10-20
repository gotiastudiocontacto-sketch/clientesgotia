# Publicar Orden de Clientes en Vercel (datos en la nube)

Con esto, al abrir tu enlace de Vercel en cualquier computadora o celular ves y editas **la misma información**, protegida con una clave.

Se suben tres archivos, todos sueltos en la misma carpeta (sin subcarpetas):

- `index.html` (la app)
- `datos.js` (la función que guarda los datos)
- `vercel.json` (le dice a Vercel que `datos.js` es la función y la publica en `/api/datos`)

---

## 1. Subir el proyecto

**Opción A, sin terminal (con GitHub):**

1. Entra a github.com, crea un repositorio nuevo (por ejemplo `orden-clientes`) y márcalo como **Private**.
2. Elige *uploading an existing file*, arrastra `index.html`, `datos.js` y `vercel.json`, y confirma con **Commit changes**.
3. En vercel.com: **Add New → Project**, importa ese repositorio. En *Framework Preset* deja **Other** y pulsa **Deploy**.

Vercel puede mostrar un aviso de que, por usar `builds` en `vercel.json`, no aplica la configuración de compilación del proyecto. Es normal: esta app no necesita compilación.

**Opción B, con terminal (en esta carpeta):**

```
npx vercel
npx vercel --prod
```

La primera vez te pide iniciar sesión y unas preguntas: responde con los valores por defecto.

## 2. Conectar la base de datos (gratis)

1. En tu proyecto de Vercel, abre la pestaña **Storage** y elige **Create Database**.
2. Elige **Upstash for Redis**, plan **Free**, y como región la misma de tus funciones de Vercel (por defecto US East, Washington D.C.).
3. Pulsa **Connect** al proyecto y marca todos los entornos (Production, Preview y Development).

Esto crea solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`. No tienes que copiarlas.

## 3. Crear tu clave de acceso

En **Settings → Environment Variables** agrega:

- **Key:** `CLAVE_ACCESO`
- **Value:** una clave larga que solo tú conozcas (mínimo 8 caracteres; mejor una frase de 12 o más)
- Marca todos los entornos y guarda.

## 4. Volver a publicar

Las variables nuevas solo aplican a publicaciones nuevas: ve a **Deployments**, abre el menú **⋯** del último y pulsa **Redeploy**.

## 5. Entrar

Abre tu enlace (`https://tu-proyecto.vercel.app`), escribe la clave y deja marcado **Recordar en este dispositivo**. Repite esto en cada celular o computadora.

## 6. Pasar tus clientes actuales a la nube

1. En el archivo de tu computadora (este `index.html` abierto con doble clic), ve a **Ajustes → Exportar respaldo (.json)**.
2. En el enlace de Vercel, ve a **Ajustes → Importar respaldo → Reemplazar todo** y elige ese archivo.

Desde ahí, usa siempre el enlace de Vercel.

---

## Cómo funciona

- Cada cambio se sube solo en un segundo. Los otros dispositivos lo ven en menos de 30 segundos, o apenas vuelves a la pestaña.
- Arriba a la derecha ves el estado: **Sincronizado**, **Guardando…** o **Sin conexión**. Si haces clic, sincroniza en ese momento.
- **Sin internet** puedes seguir trabajando: los cambios quedan en ese dispositivo y se suben al volver la conexión.
- Si dos personas editan a la vez, se unen cliente por cliente y queda el cambio más reciente de cada uno. Los clientes eliminados no reaparecen.
- Todos los enlaces del proyecto (el principal y las vistas previas) usan la misma base de datos, siempre que la hayas conectado a todos los entornos.

## Seguridad

- Sin la clave nadie ve nada: la función rechaza cualquier pedido sin la clave correcta.
- Después de 20 intentos fallidos, esa conexión queda bloqueada 15 minutos.
- **Cambiar la clave:** edita `CLAVE_ACCESO` en Vercel y haz *Redeploy*. Todos los dispositivos pedirán la nueva.
- En una computadora prestada usa **Ajustes → Cerrar sesión en este dispositivo**: borra la clave y la copia local.
- Igual conviene descargar un respaldo (.json) de vez en cuando y guardarlo en tu OneDrive.

## Límites del plan gratis de Upstash

256 MB de datos y 500.000 operaciones al mes. Para esta app sobra: cada dispositivo abierto usa unas pocas operaciones por minuto.

## Si algo falla

| Mensaje o síntoma | Solución |
|---|---|
| "Falta la variable CLAVE_ACCESO" | Paso 3 y luego *Redeploy* |
| "Falta conectar la base de datos" | Paso 2 y luego *Redeploy* |
| El indicador dice **Solo este navegador** | Falta subir `datos.js` o `vercel.json`, o el sitio no está en Vercel |
| "Clave incorrecta" | Revisa mayúsculas y espacios de `CLAVE_ACCESO` |
