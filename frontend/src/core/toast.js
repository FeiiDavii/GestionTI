/**
 * toast.js
 * Sistema unificado de notificaciones toast y diálogos de confirmación (Design System GestionTI).
 *
 * Características:
 *  - Posición top-end (esquina superior derecha)
 *  - Barra de progreso inferior animada (timerProgressBar)
 *  - Botón de cierre (showCloseButton)
 *  - Pausa al pasar el mouse (mouseenter/mouseleave)
 *  - Usa variables CSS del tema (--surface-primary, --text-color, --primary-color, --error-color)
 *  - Auto-dismiss en 3.2 segundos
 */
import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  showCloseButton: true,
  closeButtonAriaLabel: 'Cerrar notificación',
  timer: 3200,
  timerProgressBar: true,
  background: 'var(--surface-primary)',
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
 * Dispara un modal de SweetAlert2 completamente adaptado al tema activo (Claro / Oscuro).
 * @param {object} options - Opciones estándar de Swal.fire
 */
export function fireThemedSwal(options = {}) {
  const isDanger = options.confirmVariant === 'danger' || options.icon === 'warning' && options.confirmButtonColor === '#dc3545';
  const { confirmVariant, ...rest } = options;

  return Swal.fire({
    background: 'var(--surface-primary)',
    color: 'var(--text-color)',
    confirmButtonColor: isDanger ? 'var(--error-color)' : 'var(--primary-color)',
    cancelButtonColor: 'var(--surface-secondary)',
    customClass: {
      popup: 'swal-modal-custom',
      confirmButton: isDanger ? 'btn btn-danger' : 'btn btn-primary',
      cancelButton: 'btn btn-secondary',
      ...(rest.customClass || {}),
    },
    ...rest,
  });
}

/**
 * Muestra un diálogo de confirmación centrado (para acciones destructivas o importantes).
 * Soporta tanto showConfirm({ title, text, ... }, callback) como showConfirm(title, text, options).
 */
export function showConfirm(arg1, arg2, arg3) {
  let config = {};
  let onConfirmCallback = null;

  if (typeof arg1 === 'string' && typeof arg2 === 'string') {
    const opts = (arg3 && typeof arg3 === 'object') ? arg3 : {};
    config = {
      title: arg1,
      text: arg2,
      icon: opts.icon || 'warning',
      confirmButtonText: opts.confirmButtonText || opts.confirmText || 'Sí, continuar',
      cancelButtonText: opts.cancelButtonText || opts.cancelText || 'Cancelar',
      confirmVariant: opts.confirmVariant || (opts.isDanger ? 'danger' : undefined),
    };
  } else if (typeof arg1 === 'string') {
    config = { title: '¿Estás seguro?', text: arg1, icon: 'warning' };
    onConfirmCallback = typeof arg2 === 'function' ? arg2 : null;
  } else if (arg1 && typeof arg1 === 'object') {
    config = {
      ...arg1,
      confirmButtonText: arg1.confirmButtonText || arg1.confirmText || 'Sí, continuar',
      cancelButtonText: arg1.cancelButtonText || arg1.cancelText || 'Cancelar',
      confirmVariant: arg1.confirmVariant || (arg1.isDanger ? 'danger' : undefined),
    };
    onConfirmCallback = typeof arg2 === 'function' ? arg2 : null;
  }

  return fireThemedSwal({
    title: '¿Estás seguro?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--primary-color)',
    cancelButtonColor: 'var(--error-color)',
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    ...config,
  }).then((result) => {
    if (result.isConfirmed && typeof onConfirmCallback === 'function') {
      onConfirmCallback(result);
    }
    return result;
  });
}

export default showToast;

