/**
 * Formas de los datos del dominio de usuarios.
 *
 * El proyecto es JavaScript, así que los tipos se declaran con JSDoc: el editor
 * y `tsc --noEmit` los aprovechan sin necesidad de migrar a TypeScript.
 */

/**
 * Fila de la tabla `usuarios` tal como la devuelve la API.
 * ⚠️ Nunca incluye `password`.
 *
 * @typedef {Object} Usuario
 * @property {number} usuario_id
 * @property {string|null} nombre
 * @property {string|null} apellido
 * @property {string} email
 * @property {'admin'|'auditor'|'visualizador'|'gestor'} rol
 * @property {'activo'|'inactivo'} estado
 * @property {string|null} auth_user_id
 * @property {string|null} tipo_personal
 * @property {number|null} dependencia_id
 * @property {string|null} estudios
 * @property {string|null} tipo_estudio
 * @property {string|null} celular
 */

/**
 * Resultado del envío de credenciales por correo.
 *
 * @typedef {Object} ResultadoNotificacion
 * @property {'email'} channel
 * @property {string} type
 * @property {boolean} ok
 * @property {string} [message]
 */

export {}
