
export async function onRequest(context) {
  const { request, env } = context;

  // Si no configuras la contraseña en Cloudflare, el sitio se verá público
  if (!env.APP_PASSWORD) {
    return await context.next();
  }

  const authHeader = request.headers.get('Authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic') {
      try {
        const decoded = atob(encoded);
        // El formato es usuario:contraseña. Ignoramos el usuario y solo validamos la clave.
        const [_, password] = decoded.split(':');

        if (password === env.APP_PASSWORD) {
          return await context.next(); // Contraseña correcta, pasa
        }
      } catch (e) {
        // Error al decodificar, continúa abajo para pedir credenciales de nuevo
      }
    }
  }

  // Si no hay contraseña o es incorrecta, mostramos el cuadro de diálogo del navegador
  return new Response('Acceso restringido', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Ingresa la contraseña de acceso"',
    },
  });
}