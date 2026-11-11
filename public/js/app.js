/**
 * Mejoras progresivas de la interfaz. La aplicación funciona sin JavaScript;
 * este archivo solo agrega comodidad (filtrar espacios por sede y evitar doble envío).
 * Las validaciones y permisos reales se aplican siempre en el servidor.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Filtra el selector "Sala o laboratorio" para mostrar solo los espacios de la sede elegida.
  document.querySelectorAll('select[data-filtra]').forEach((selectorSede) => {
    const selectorEspacio = document.getElementById(selectorSede.dataset.filtra);
    if (!selectorEspacio) return;
    const aplicar = () => {
      const sede = selectorSede.value;
      selectorEspacio.querySelectorAll('optgroup').forEach((grupo) => {
        const visible = !sede || grupo.dataset.sede === sede;
        grupo.hidden = !visible;
        grupo.disabled = !visible;
      });
      const elegido = selectorEspacio.selectedOptions[0];
      if (elegido && elegido.parentElement.tagName === 'OPTGROUP' && elegido.parentElement.disabled) {
        selectorEspacio.value = '';
      }
    };
    selectorSede.addEventListener('change', aplicar);
    aplicar();
  });

  // Envía automáticamente los filtros simples (p. ej. la sede en el panel de administración).
  document.querySelectorAll('select[data-autoenvio]').forEach((selector) => {
    selector.addEventListener('change', () => selector.form.submit());
  });

  // Evita el doble clic en formularios de confirmación (el servidor igualmente impide duplicados).
  document.querySelectorAll('form[data-un-envio]').forEach((formulario) => {
    formulario.addEventListener('submit', () => {
      formulario.querySelectorAll('button[type="submit"]').forEach((boton) => {
        boton.disabled = true;
        boton.textContent = 'Procesando…';
      });
    });
  });
});
