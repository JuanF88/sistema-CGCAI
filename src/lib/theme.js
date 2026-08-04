/**
 * Modo claro / oscuro.
 *
 * El tema se aplica poniendo o quitando la clase `.dark` en `<html>`, que es lo
 * que activa el bloque `.dark` de `globals.css`.
 *
 * ⚠️ El valor por defecto es **claro**, no la preferencia del sistema: la mayoría
 * de las pantallas todavía usa CSS modules con colores claros fijos, así que
 * arrancar en oscuro las dejaría a medias. El modo oscuro es opt-in hasta que
 * todas estén migradas al tema.
 */
export const THEME_STORAGE_KEY = 'cgcai:theme'

export const THEMES = { LIGHT: 'light', DARK: 'dark' }

/** Aplica el tema al documento. Seguro de llamar en el servidor (no hace nada). */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === THEMES.DARK)
  document.documentElement.style.colorScheme = theme === THEMES.DARK ? 'dark' : 'light'
}

/** Lee el tema guardado; `light` si no hay nada o localStorage está bloqueado. */
export function readStoredTheme() {
  if (typeof window === 'undefined') return THEMES.LIGHT
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === THEMES.DARK
      ? THEMES.DARK
      : THEMES.LIGHT
  } catch {
    return THEMES.LIGHT
  }
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* modo privado o storage bloqueado: el tema dura solo esta sesión */
  }
}

/**
 * Script que se inyecta en el <head> y corre **antes del primer pintado**.
 * Sin esto, quien tenga el modo oscuro guardado vería un parpadeo blanco.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem('${THEME_STORAGE_KEY}');
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
}catch(e){}})();
`
