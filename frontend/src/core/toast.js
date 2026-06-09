/**
 * toast.js
 * Sistema de notificaciones toast — réplica exacta de window.showToast()
 * del sistema original IAV2 (assets/js/layout/main.js).
 *
 * Características:
 *  - Posición top-end (esquina superior derecha)
 *  - Barra de progreso inferior animada (timerProgressBar)
 *  - Botón de cierre (showCloseButton)
 *  - Pausa al pasar el mouse (mouseenter/mouseleave)
 *  - Usa variables CSS del tema (--card-bg, --text-color)
 *  - Auto-dismiss en 3 segundos
 */
import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  showCloseButton: true,
  closeButtonAriaLabel: 'Cerrar notificación',
  timer: 3000,
  timerProgressBar: true,
  background: 'var(--card-bg)',
  color: 'var(--text-color)',
  customClass: {
    popup: 'swal-toast-custom',
  },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

/**
 * Muestra una notificación toast en la esquina superior derecha.
 * @param {string} title  - Mensaje a mostrar
 * @param {string} icon   - 'success' | 'error' | 'warning' | 'info' | 'question'
 */
export function showToast(title, icon = 'success') {
  Toast.fire({ icon, title });
}

/**
 * Muestra un diálogo de confirmación centrado (para acciones destructivas).
 * Idéntico a window.showConfirm() del original.
 * @param {string}   text             - Texto descriptivo de la acción
 * @param {Function} onConfirmCallback - Callback ejecutado si el usuario confirma
 */
export function showConfirm(text, onConfirmCallback) {
  Swal.fire({
    title: '¿Estás seguro?',
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--primary-color)',
    cancelButtonColor: 'var(--error-color)',
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    background: 'var(--card-bg)',
    color: 'var(--text-color)',
  }).then((result) => {
    if (result.isConfirmed && typeof onConfirmCallback === 'function') {
      onConfirmCallback();
    }
  });
}

export default showToast;
