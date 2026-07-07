# Cómo subir la app a la nube (gratis)

## Opción 1: Render (más fácil, recomendado)

1. Crea una cuenta en https://render.com (GitHub o Google)
2. Haz clic en **"New +"** > **"Web Service"**
3. Conecta tu repositorio de GitHub, o usa:
   - **Public Git repository**: `https://github.com/tu-usuario/control-chicha`
4. Render detectará automáticamente Node.js
5. Configura:
   - **Name**: `control-chicha`
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free** ($0/mes)
6. Haz clic en **"Create Web Service"**
7. Espera 2-3 minutos a que se despliegue
8. Recibirás una URL como `https://control-chicha.onrender.com`

### Acceder desde el celular:
- Simplemente abre la URL de Render en el navegador del celular
- Guarda la URL en la pantalla de inicio como una "app"

## Opción 2: Railway

1. Cuenta en https://railway.app
2. Crea un nuevo proyecto desde GitHub
3. Railway detecta Node.js automáticamente
4. Plan gratuito con $5 de crédito

## Opción 3: Fly.io

1. Instala flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. En la terminal: `fly launch` y sigue los pasos
3. Plan gratuito: 3 apps, 256MB RAM

---

## Probar localmente

```bash
cd control-chicha
npm install
npm start
```

Abre http://localhost:3000 en el navegador.
Para probar desde el celular, usa la IP de tu PC en la misma red WiFi.
