import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { equipmentAPI, auxAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

/* ==========================================================================
   Helpers / Validators
   ========================================================================== */

const validators = {
  alphanumeric: (v) => /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-_.]+$/.test(v),
  minLength: (v, min = 2) => v?.trim().length >= min,
  onlyAlpha: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v),
  onlyNumeric: (v) => /^\d+$/.test(v),
};

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStockBadgeClass(stock) {
  if (stock == null) return 'badge-consulta';
  if (stock <= 0) return 'badge-eliminar';
  if (stock <= 3) return 'badge-avanzado';
  return 'badge-administrador';
}

function getStockLabel(stock) {
  if (stock == null) return 'N/A';
  if (stock <= 0) return 'Sin Stock';
  if (stock <= 3) return 'Stock Bajo';
  return `Stock: ${stock}`;
}

/* ==========================================================================
   Tab Configuration
   ========================================================================== */

const TABS = [
  { key: 'equipos', label: 'Equipos', icon: 'fa-computer' },
  { key: 'impresoras', label: 'Impresoras/Escáneres', icon: 'fa-print' },
  { key: 'monitores', label: 'Monitores', icon: 'fa-display' },
  { key: 'telefonos', label: 'Teléfonos', icon: 'fa-phone' },
  { key: 'otros', label: 'Otros', icon: 'fa-cube' },
  { key: 'funcionarios', label: 'Funcionarios', icon: 'fa-users' },
  { key: 'areas', label: 'Áreas', icon: 'fa-building' },
  { key: 'marcas', label: 'Marcas', icon: 'fa-tag' },
  { key: 'tipos', label: 'Tipos', icon: 'fa-list' },
  { key: 'configuraciones', label: 'Configuraciones', icon: 'fa-gear' },
];

/* Dense and consolidated columns to match the legacy PHP layout */
const COLUMNS = {
  equipos: [
    { key: 'nombre_info', label: 'Nombre / Procesador' },
    { key: 'serial_info', label: 'Serial / S.Int' },
    { key: 'marca_modelo', label: 'Marca / Modelo' },
    { key: 'tipo_config', label: 'Tipo / Config' },
    { key: 'ubicacion_resp', label: 'Ubicación' },
  ],
  impresoras: [
    { key: 'tipo', label: 'Tipo' },
    { key: 'serial_info', label: 'Seriales' },
    { key: 'marca_modelo', label: 'Marca / Modelo' },
    { key: 'conexion', label: 'Conexión' },
  ],
  monitores: [
    { key: 'serial_info', label: 'Seriales' },
    { key: 'marca_modelo', label: 'Marca / Modelo' },
    { key: 'conexion', label: 'Asignado a' },
  ],
  telefonos: [
    { key: 'ext_ip', label: 'Ext / IP' },
    { key: 'serial', label: 'Serial' },
    { key: 'marca_nombre', label: 'Marca' },
    { key: 'usuario', label: 'Usuario' },
  ],
  otros: [
    { key: 'tipo', label: 'Tipo' },
    { key: 'serial', label: 'Serial' },
    { key: 'modelo', label: 'Modelo' },
    { key: 'ubicacion', label: 'Ubicación' },
  ],
  funcionarios: [
    { key: 'nombre_completo', label: 'Nombre' },
    { key: 'celular', label: 'Celular' },
    { key: 'nombre_area', label: 'Área' },
  ],
  areas: [
    { key: 'nombre_area', label: 'Nombre Área' },
    { key: 'codigo_area', label: 'Código' },
  ],
  marcas: [
    { key: 'nombre_marca', label: 'Nombre Marca' },
  ],
  tipos: [
    { key: 'tipo', label: 'Nombre Tipo' },
  ],
  configuraciones: [
    { key: 'ram_rom', label: 'Configuración (RAM/ROM)' },
    { key: 'descripcion', label: 'Descripción' },
  ],
};

/* -----------------------------------------------------------------------
   Form section helper
   ----------------------------------------------------------------------- */

const FormSection = ({ title, icon, children }) => (
  <div className="form-section">
    <div className="form-section-title">
      <i className={`fa-solid ${icon}`}></i> {title}
    </div>
    <div className="form-section-body">
      {children}
    </div>
  </div>
);

/* -----------------------------------------------------------------------
   Componente principal
   ----------------------------------------------------------------------- */

export default function Equipos() {
  const { hasPermission } = useAuth();

  // -- Tabs --
  const [activeTab, setActiveTab] = useState('equipos');

  // -- Data --
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10); // Rows per page
  const [page, setPage] = useState(1);

  // -- Aux lists --
  const [aux, setAux] = useState({
    marcas: [],
    areas: [],
    tipos: [],
    configuraciones: [],
    funcionarios: [],
    equipos: [],
  });

  // -- Modal CRUD --
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('equipos');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // -- Quick Add Modal --
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('');
  const [quickAddForm, setQuickAddForm] = useState({});
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // -- FAB --


  // -- Search --
  const [searchTerm, setSearchTerm] = useState('');

  // -- Permission helpers --
  const canCrearEditar = hasPermission('inv_crear_editar');
  const canEliminar = hasPermission('inv_eliminar');

  /* -----------------------------------------------------------------------
     Carga de datos
     ----------------------------------------------------------------------- */

  const extractData = (res) => {
    try {
      const d = res.data?.success ? res.data.data : (res.data || res);
      return Array.isArray(d) ? d : [];
    } catch { return []; }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [equiposRes, listasRes, funcionariosRes, areasRes, marcasRes, tiposRes, configsRes] =
        await Promise.all([
          equipmentAPI.list(),
          equipmentAPI.listas(),
          auxAPI.funcionarios(),
          auxAPI.areas(),
          auxAPI.marcas(),
          auxAPI.tipos(),
          auxAPI.hardwareConfigs(),
        ]);

      const inv = equiposRes.data?.success ? equiposRes.data.data : (equiposRes.data || {});

      setData({
        equipos: Array.isArray(inv.equipos) ? inv.equipos : [],
        impresoras: Array.isArray(inv.impresoras) ? inv.impresoras : [],
        monitores: Array.isArray(inv.monitores) ? inv.monitores : [],
        telefonos: Array.isArray(inv.telefonos) ? inv.telefonos : [],
        otros: Array.isArray(inv.otros) ? inv.otros : [],
        funcionarios: extractData(funcionariosRes),
        areas: extractData(areasRes),
        marcas: extractData(marcasRes),
        tipos: extractData(tiposRes),
        configuraciones: extractData(configsRes),
      });

      const l = listasRes.data?.success ? listasRes.data.data : (listasRes.data || {});
      setAux({
        marcas: l.marcas || extractData(marcasRes),
        areas: l.areas || extractData(areasRes),
        tipos: l.tipos || extractData(tiposRes),
        configuraciones: l.configuraciones || extractData(configsRes),
        funcionarios: l.funcionarios || extractData(funcionariosRes),
        equipos: l.equipos || [],
      });
    } catch (err) {
      console.error('Error cargando datos de inventario:', err);
      showToast('Error: No se pudieron cargar los datos del inventario.', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Escuchar actualizaciones del sistema via SSE
  useEffect(() => {
    const handler = () => loadAll();
    window.addEventListener('rt:system_update', handler);
    return () => window.removeEventListener('rt:system_update', handler);
  }, [loadAll]);

  /* -----------------------------------------------------------------------
     CRUD helpers
     ----------------------------------------------------------------------- */

  const getTabCategory = (tab) => {
    const map = {
      equipos: 'Equipo',
      impresoras: 'Impresora',
      monitores: 'Monitor',
      telefonos: 'Teléfono',
      otros: 'Otro',
    };
    return map[tab] || null;
  };

  const openCreateModal = (tab) => {
    if (!canCrearEditar) {
      showToast('Sin permiso: No tienes permisos para crear o editar registros.', 'warning');
      return;
    }
    setModalTab(tab);
    setEditingItem(null);
    setFormData(getDefaultForm(tab));
    setModalOpen(true);
  };

  const openEditModal = (item, tab) => {
    if (!canCrearEditar) {
      showToast('Sin permiso: No tienes permisos para crear o editar registros.', 'warning');
      return;
    }
    setModalTab(tab);
    setEditingItem(item);
    setFormData({ ...item });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalTab('equipos');
    setEditingItem(null);
    setFormData({});
  };

  const getDefaultForm = (tab) => {
    switch (tab) {
      case 'equipos':
        return {
          nombre_equipo: '',
          procesador: '',
          id_tipo: '',
          id_configuracion: '',
          id_marca: '',
          modelo: '',
          serial: '',
          serial_interno: '',
          id_area: '',
          id_usuario: '',
          fecha_compra: '',
          precio_compra: '',
          nivel_clasificacion: 'Interno',
          prot_cifrado: 0,
          prot_antivirus: 0,
          prot_firewall: 0
        };
      case 'impresoras':
        return { id_tipo: '', id_marca: '', modelo: '', serial: '', serial_interno: '', id_equipo: '' };
      case 'monitores':
        return { id_marca: '', modelo: '', serial: '', serial_interno: '', id_equipo: '' };
      case 'telefonos':
        return { id_marca: '', serial: '', ip: '', extension: '', id_usuario: '' };
      case 'otros':
        return { id_tipo: '', id_marca: '', modelo: '', serial: '', id_area: '' };
      case 'funcionarios':
        return { nombre: '', apellido: '', celular: '', id_area: '' };
      case 'areas':
        return { nombre_area: '', codigo_area: '' };
      case 'marcas':
        return { nombre_marca: '' };
      case 'tipos':
        return { tipo: '' };
      case 'configuraciones':
        return { ram_rom: '', descripcion: '' };
      default:
        return {};
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* -----------------------------------------------------------------------
     Validación del formulario
     ----------------------------------------------------------------------- */

  const validateForm = (tab) => {
    const f = formData;
    const targetTab = tab || modalTab;

    switch (targetTab) {
      case 'equipos':
        if (!validators.minLength(f.nombre_equipo, 2)) return 'El nombre del equipo debe tener al menos 2 caracteres.';
        if (!validators.alphanumeric(f.nombre_equipo)) return 'El nombre del equipo solo puede contener caracteres alfanuméricos.';
        if (!validators.minLength(f.serial, 2)) return 'El número de serie es obligatorio.';
        break;
      case 'impresoras':
      case 'monitores':
      case 'telefonos':
        if (!validators.minLength(f.serial, 2)) return 'El número de serie o IMEI es obligatorio.';
        break;
      case 'otros':
        if (!validators.minLength(f.serial, 2)) return 'El número de serie es obligatorio.';
        break;
      case 'funcionarios':
        if (!validators.minLength(f.nombre, 2)) return 'El nombre debe tener al menos 2 caracteres.';
        if (!validators.onlyAlpha(f.nombre)) return 'El nombre solo puede contener letras.';
        if (!validators.minLength(f.apellido, 2)) return 'El apellido debe tener al menos 2 caracteres.';
        if (!validators.onlyAlpha(f.apellido)) return 'El apellido solo puede contener letras.';
        break;
      case 'areas':
        if (!validators.minLength(f.nombre_area, 2)) return 'El nombre del área debe tener al menos 2 caracteres.';
        if (!validators.minLength(f.codigo_area, 1)) return 'El código del área es obligatorio.';
        break;
      case 'marcas':
        if (!validators.minLength(f.nombre_marca, 1)) return 'El nombre de la marca es obligatorio.';
        break;
      case 'tipos':
        if (!validators.minLength(f.tipo, 2)) return 'El nombre del tipo debe tener al menos 2 caracteres.';
        break;
      case 'configuraciones':
        if (!validators.minLength(f.ram_rom, 2)) return 'La configuración (RAM/ROM) debe tener al menos 2 caracteres.';
        break;
      default:
        break;
    }
    return null;
  };

  /* -----------------------------------------------------------------------
     Guardar (Crear / Actualizar)
     ----------------------------------------------------------------------- */

  const handleSave = async () => {
    const validationError = validateForm(modalTab);
    if (validationError) {
      showToast('Validación: ' + validationError, 'warning');
      return;
    }

    try {
      let res;
      const tab = modalTab;
      const category = getTabCategory(tab);

      const payload = {
        table_target: tab,
        ...formData,
      };

      if (category) {
        payload.categoria = category;
      }

      if (editingItem) {
        payload.id = editingItem.id;
        res = await equipmentAPI.update(payload);
      } else {
        res = await equipmentAPI.create(payload);
      }

      const result = res.data;
      if (result.success) {
        showToast('Guardado correctamente', 'success');
        closeModal();
        loadAll();
      } else {
        showToast('Error: ' + (result.message || 'No se pudo guardar el registro.'), 'error');
      }
    } catch (err) {
      showToast('Error: ' + (err.response?.data?.message || 'Error al guardar el registro.'), 'error');
    }
  };

  /* -----------------------------------------------------------------------
     Eliminar
     ----------------------------------------------------------------------- */

  const handleDelete = async (item) => {
    if (!canEliminar) {
      showToast('Sin permiso: No tienes permisos para eliminar registros.', 'warning');
      return;
    }

    const valLabel = item.nombre_equipo || item.modelo || item.nombre_marca || item.nombre_area || item.tipo || item.ram_rom || item.serial || item.nombre || item.id;

    const result = await Swal.fire({
      title: '¿Eliminar registro?',
      text: `¿Estás seguro de eliminar "${valLabel}"? Esta acción no se puede deshacer.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      const res = await equipmentAPI.delete(item.id, activeTab);
      const data_ = res.data;
      if (data_.success) {
        showToast('Eliminado correctamente', 'success');
        loadAll();
      } else {
        showToast('Error: ' + (data_.message || 'No se pudo eliminar el registro.'), 'error');
      }
    } catch (err) {
      showToast('Error: ' + (err.response?.data?.message || 'Error al eliminar el registro.'), 'error');
    }
  };

  /* -----------------------------------------------------------------------
     Quick Add
     ----------------------------------------------------------------------- */

  const openQuickAdd = (type) => {
    setQuickAddType(type);
    setQuickAddForm({ nombre: '' });
    setQuickAddOpen(true);
  };

  const closeQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickAddType('');
    setQuickAddForm({});
  };

  const handleQuickAddSave = async () => {
    const val = quickAddForm.nombre?.trim();
    if (!val || val.length < 2) {
      showToast('Validación: Debe ingresar al menos 2 caracteres.', 'warning');
      return;
    }

    setQuickAddLoading(true);
    try {
      const typeMap = {
        marcas: 'marca',
        areas: 'area',
        tipos: 'tipo',
        configuraciones: 'configuracion',
        funcionarios: 'funcionario'
      };
      const mappedType = typeMap[quickAddType] || quickAddType;

      const payload = {
        type: mappedType,
        nombre: val,
        apellido: quickAddForm.apellido || '',
        celular: quickAddForm.celular || '',
        id_area: quickAddForm.id_area || '',
        codigo_area: quickAddForm.codigo_area || '',
        descripcion: quickAddForm.descripcion || ''
      };

      const res = await auxAPI.save(payload);
      if (res.data.success) {
        showToast('Creado correctamente', 'success');
        closeQuickAdd();
        
        // Refresh auxiliary data lists
        const [m, a, t, c, f] = await Promise.all([
          auxAPI.marcas(), auxAPI.areas(), auxAPI.tipos(),
          auxAPI.hardwareConfigs(), auxAPI.funcionarios(),
        ]);
        
        setAux((prev) => ({
          ...prev,
          marcas: extractData(m),
          areas: extractData(a),
          tipos: extractData(t),
          configuraciones: extractData(c),
          funcionarios: extractData(f),
        }));
        
        loadAll();
      } else {
        showToast('Error: ' + (res.data.message || 'No se pudo crear.'), 'error');
      }
    } catch (err) {
      showToast('Error: ' + (err.response?.data?.message || 'Error al crear.'), 'error');
    }
    setQuickAddLoading(false);
  };

  /* -----------------------------------------------------------------------
     Render helpers
     ----------------------------------------------------------------------- */

  const getOptionLabel = (opt, field) => {
    if (!opt) return '';
    if (field === 'id_marca' || field === 'marca_id') return opt.nombre_marca || opt.nombre;
    if (field === 'id_tipo' || field === 'tipo') return opt.tipo || opt.nombre;
    if (field === 'id_area' || field === 'area_id') return opt.nombre_area || opt.nombre;
    if (field === 'id_configuracion') return opt.ram_rom || opt.nombre;
    if (field === 'id_usuario' || field === 'funcionario_id') {
      if (opt.nombre && opt.apellido) return `${opt.nombre} ${opt.apellido}`;
      return opt.nombre || opt.nombre_usuario || opt.name || '';
    }
    if (field === 'id_equipo') return `${opt.nombre_equipo || opt.nombre || ''} (S: ${opt.serial || ''})`;
    return opt.nombre || opt.clave || opt.ram_rom || opt.tipo || opt.nombre_marca || opt.nombre_area || opt.name || '';
  };

  const renderCellValue = (row, col) => {
    const val = row[col.key];

    // Consolidated fields mapping
    switch (col.key) {
      case 'nombre_info':
        return (
          <>
            <strong>{row.nombre_equipo || row.nombre || '-'}</strong>
            <br />
            <small className="text-gray-text">{row.procesador || ''}</small>
          </>
        );
      case 'serial_info':
        return (
          <>
            <span>S: {row.serial || '-'}</span>
            <br />
            <small className="text-gray-text">Int: {row.serial_interno || '-'}</small>
          </>
        );
      case 'marca_modelo':
        return (
          <>
            <span>{row.nombre_marca || '-'}</span>
            <br />
            <small className="text-gray-text">{row.modelo || ''}</small>
          </>
        );
      case 'ubicacion':
        return <span>{row.nombre_area || '-'}</span>;
      case 'tipo_config':
        return (
          <>
            <span>{row.tipo || '-'}</span>
            <br />
            <small className="text-gray-text">{row.ram_rom || ''}</small>
          </>
        );
      case 'ubicacion_resp':
        return (
          <>
            <span>{row.nombre_area || '-'}</span>
            <br />
            <small style={{ color: 'var(--primary-color)', fontWeight: 500 }}>
              {row.nombre_usuario || '-'}
            </small>
          </>
        );
      case 'conexion':
        return <span>{row.nombre_equipo || 'Red / Standalone'}</span>;
      case 'ext_ip':
        return (
          <>
            <strong>Ext: {row.extension || '-'}</strong>
            <br />
            <small className="text-gray-text">IP: {row.ip || '-'}</small>
          </>
        );
      case 'usuario':
        return <span>{row.nombre_usuario || '--'}</span>;
      case 'nombre_completo':
        return <strong>{row.nombre} {row.apellido}</strong>;
      case 'nombre_area':
        return <span>{row.nombre_area}</span>;
      case 'codigo_area':
        return <span>{row.codigo_area || '-'}</span>;
      case 'nombre_marca':
      case 'marca_nombre':
        return <strong>{row.nombre_marca}</strong>;
      case 'tipo':
        return <strong>{row.tipo}</strong>;
      case 'ram_rom':
        return <strong>{row.ram_rom}</strong>;
      default:
        // Dates
        if (col.key === 'created_at' && val) {
          return new Date(val).toLocaleDateString('es-CO', {
            year: 'numeric', month: '2-digit', day: '2-digit',
          });
        }
        return val ?? '-';
    }
  };

  const renderFormField = (field, label, options = {}) => {
    const { type = 'text', required = false, placeholder = '', options: selectOptions = [] } = options;

    const showQuickAdd = options.quickAddType && canCrearEditar;

    if (type === 'select') {
      return (
        <div className="form-group" key={field}>
          <label>{label}{required && <span className="text-danger"> *</span>}</label>
          <div className="select-with-quickadd" style={{ display: 'flex', gap: '8px' }}>
            <SearchableSelect
              value={formData[field] || ''}
              onChange={(val) => handleFormChange(field, val)}
              options={selectOptions.map(opt => ({
                value: opt.id,
                label: getOptionLabel(opt, field)
              }))}
            />
            {showQuickAdd && (
              <button
                type="button"
                className="btn-quick-add"
                title={`Agregar ${options.quickAddLabel || options.quickAddType}`}
                onClick={() => openQuickAdd(options.quickAddType)}
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <div className="form-group" key={field}>
          <label>{label}</label>
          <textarea
            className="form-control"
            value={formData[field] || ''}
            onChange={(e) => handleFormChange(field, e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        </div>
      );
    }

    if (type === 'checkbox') {
      return (
        <div className="form-group checkbox-group" key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <input
            type="checkbox"
            id={field}
            checked={!!formData[field]}
            onChange={(e) => handleFormChange(field, e.target.checked ? 1 : 0)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor={field} style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>{label}</label>
        </div>
      );
    }

    return (
      <div className="form-group" key={field}>
        <label>{label}{required && <span className="text-danger"> *</span>}</label>
        <input
          type={type}
          className="form-control"
          value={formData[field] || ''}
          onChange={(e) => handleFormChange(field, e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );
  };

  /* -----------------------------------------------------------------------
     Sección: datos de la tabla activa
     ----------------------------------------------------------------------- */

  const currentData = data[activeTab] || [];
  const columns = COLUMNS[activeTab] || [];
  const showActions = canCrearEditar || canEliminar;
  const isAuxTab = ['funcionarios', 'areas', 'marcas', 'tipos', 'configuraciones'].includes(activeTab);

  const getModalTitle = () => {
    const prefix = editingItem ? 'Editar' : 'Nuevo';
    const tabLabel = TABS.find((t) => t.key === modalTab)?.label || modalTab;
    return `${prefix} ${tabLabel}`;
  };

  const renderFormFields = () => {
    switch (modalTab) {
      case 'equipos':
        return (
          <>
            <FormSection title="Identificación" icon="fa-tag">
              {renderFormField('nombre_equipo', 'Nombre del Equipo', { required: true, placeholder: 'Nombre del equipo' })}
              <div className="form-row">
                {renderFormField('procesador', 'Procesador', { placeholder: 'Ej: Intel Core i7' })}
                {renderFormField('modelo', 'Modelo', { placeholder: 'Modelo' })}
              </div>
            </FormSection>

            <FormSection title="Clasificación" icon="fa-sitemap">
              <div className="form-row">
                {renderFormField('id_tipo', 'Tipo', { type: 'select', options: aux.tipos, quickAddType: 'tipos', quickAddLabel: 'Tipo' })}
                {renderFormField('id_marca', 'Marca', { type: 'select', options: aux.marcas, quickAddType: 'marcas', quickAddLabel: 'Marca' })}
              </div>
              <div className="form-row">
                {renderFormField('id_configuracion', 'Configuración (RAM/ROM)', { type: 'select', options: aux.configuraciones, quickAddType: 'configuraciones', quickAddLabel: 'Config' })}
                {renderFormField('id_area', 'Área / Ubicación', { type: 'select', options: aux.areas, quickAddType: 'areas', quickAddLabel: 'Área' })}
              </div>
            </FormSection>

            <FormSection title="Seriales" icon="fa-qrcode">
              <div className="form-row">
                {renderFormField('serial', 'N° Serie', { required: true, placeholder: 'Número de serie' })}
                {renderFormField('serial_interno', 'N° Serie Interno', { placeholder: 'Número de serie interno' })}
              </div>
            </FormSection>

            <FormSection title="Asignación" icon="fa-user-check">
              <div className="form-row">
                {renderFormField('id_usuario', 'Funcionario Responsable', { type: 'select', options: aux.funcionarios, quickAddType: 'funcionarios', quickAddLabel: 'Funcionario' })}
                {renderFormField('fecha_compra', 'Fecha de Compra', { type: 'date' })}
              </div>
              <div className="form-row">
                {renderFormField('precio_compra', 'Precio de Compra', { placeholder: 'Ej: 3.000.000' })}
                {renderFormField('nivel_clasificacion', 'Nivel de Clasificación', { type: 'select', options: [
                  { id: 'Público', nombre: 'Público' },
                  { id: 'Interno', nombre: 'Interno' },
                  { id: 'Confidencial', nombre: 'Confidencial' },
                  { id: 'Restringido', nombre: 'Restringido' }
                ] })}
              </div>
            </FormSection>

            <FormSection title="Protecciones" icon="fa-shield-halved">
              <div className="form-row" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {renderFormField('prot_cifrado', 'Cifrado de Disco', { type: 'checkbox' })}
                {renderFormField('prot_antivirus', 'Antivirus Activo', { type: 'checkbox' })}
                {renderFormField('prot_firewall', 'Firewall Habilitado', { type: 'checkbox' })}
              </div>
            </FormSection>
          </>
        );
      case 'impresoras':
        return (
          <>
            <FormSection title="Información General" icon="fa-print">
              <div className="form-row">
                {renderFormField('id_tipo', 'Tipo', { type: 'select', options: aux.tipos, quickAddType: 'tipos', quickAddLabel: 'Tipo' })}
                {renderFormField('id_marca', 'Marca', { type: 'select', options: aux.marcas, quickAddType: 'marcas', quickAddLabel: 'Marca' })}
              </div>
              {renderFormField('modelo', 'Modelo', { placeholder: 'Modelo de la impresora' })}
            </FormSection>
            <FormSection title="Seriales" icon="fa-qrcode">
              <div className="form-row">
                {renderFormField('serial', 'N° Serie', { required: true, placeholder: 'Número de serie' })}
                {renderFormField('serial_interno', 'N° Serie Interno', { placeholder: 'Número de serie interno' })}
              </div>
            </FormSection>
            <FormSection title="Conexión" icon="fa-link">
              {renderFormField('id_equipo', 'Equipo asignado', { type: 'select', options: aux.equipos })}
            </FormSection>
          </>
        );
      case 'monitores':
        return (
          <>
            <FormSection title="Información General" icon="fa-display">
              <div className="form-row">
                {renderFormField('id_marca', 'Marca', { type: 'select', options: aux.marcas, quickAddType: 'marcas', quickAddLabel: 'Marca' })}
                {renderFormField('modelo', 'Modelo', { placeholder: 'Modelo del monitor' })}
              </div>
            </FormSection>
            <FormSection title="Seriales" icon="fa-qrcode">
              <div className="form-row">
                {renderFormField('serial', 'N° Serie', { required: true, placeholder: 'Número de serie' })}
                {renderFormField('serial_interno', 'N° Serie Interno', { placeholder: 'Número de serie interno' })}
              </div>
            </FormSection>
            <FormSection title="Asignación" icon="fa-user-check">
              {renderFormField('id_equipo', 'Equipo asignado', { type: 'select', options: aux.equipos })}
            </FormSection>
          </>
        );
      case 'telefonos':
        return (
          <>
            <FormSection title="Información General" icon="fa-phone">
              <div className="form-row">
                {renderFormField('id_marca', 'Marca', { type: 'select', options: aux.marcas, quickAddType: 'marcas', quickAddLabel: 'Marca' })}
                {renderFormField('serial', 'IMEI / N° Serie', { required: true, placeholder: 'Serial o IMEI' })}
              </div>
            </FormSection>
            <FormSection title="Red" icon="fa-wifi">
              <div className="form-row">
                {renderFormField('extension', 'Extensión', { placeholder: 'Ej: 101' })}
                {renderFormField('ip', 'IP', { placeholder: 'Ej: 192.168.1.50' })}
              </div>
            </FormSection>
            <FormSection title="Asignación" icon="fa-user-check">
              {renderFormField('id_usuario', 'Funcionario asignado', { type: 'select', options: aux.funcionarios, quickAddType: 'funcionarios', quickAddLabel: 'Funcionario' })}
            </FormSection>
          </>
        );
      case 'otros':
        return (
          <>
            <FormSection title="Información General" icon="fa-cube">
              <div className="form-row">
                {renderFormField('id_tipo', 'Tipo', { type: 'select', options: aux.tipos, quickAddType: 'tipos', quickAddLabel: 'Tipo' })}
                {renderFormField('id_marca', 'Marca', { type: 'select', options: aux.marcas, quickAddType: 'marcas', quickAddLabel: 'Marca' })}
              </div>
              {renderFormField('modelo', 'Modelo', { placeholder: 'Modelo' })}
            </FormSection>
            <FormSection title="Identificación" icon="fa-qrcode">
              {renderFormField('serial', 'N° Serie / Identificador', { required: true, placeholder: 'Número de serie' })}
            </FormSection>
            <FormSection title="Ubicación" icon="fa-location-dot">
              {renderFormField('id_area', 'Área / Ubicación', { type: 'select', options: aux.areas, quickAddType: 'areas', quickAddLabel: 'Área' })}
            </FormSection>
          </>
        );
      case 'funcionarios':
        return (
          <>
            <FormSection title="Datos Personales" icon="fa-user">
              <div className="form-row">
                {renderFormField('nombre', 'Nombres', { required: true, placeholder: 'Nombres' })}
                {renderFormField('apellido', 'Apellidos', { required: true, placeholder: 'Apellidos' })}
              </div>
            </FormSection>
            <FormSection title="Contacto" icon="fa-address-book">
              <div className="form-row">
                {renderFormField('celular', 'Celular', { placeholder: 'Ej: 3001234567' })}
                {renderFormField('id_area', 'Área', { type: 'select', options: aux.areas, quickAddType: 'areas', quickAddLabel: 'Área' })}
              </div>
            </FormSection>
          </>
        );
      case 'areas':
        return (
          <FormSection title="Datos del Área" icon="fa-building">
            {renderFormField('nombre_area', 'Nombre del Área', { required: true, placeholder: 'Ej: Contabilidad' })}
            {renderFormField('codigo_area', 'Código del Área', { required: true, placeholder: 'Ej: CONT-01' })}
          </FormSection>
        );
      case 'marcas':
        return (
          <FormSection title="Nueva Marca" icon="fa-tag">
            {renderFormField('nombre_marca', 'Nombre de la Marca', { required: true, placeholder: 'Ej: Lenovo' })}
          </FormSection>
        );
      case 'tipos':
        return (
          <FormSection title="Nuevo Tipo" icon="fa-list">
            {renderFormField('tipo', 'Nombre del Tipo', { required: true, placeholder: 'Ej: Portátil o Impresora' })}
          </FormSection>
        );
      case 'configuraciones':
        return (
          <FormSection title="Configuración" icon="fa-gear">
            {renderFormField('ram_rom', 'RAM / ROM', { required: true, placeholder: 'Ej: 16GB / 512GB SSD' })}
            {renderFormField('descripcion', 'Descripción (Opcional)', { type: 'textarea', placeholder: 'Notas o descripción de la configuración' })}
          </FormSection>
        );
      default:
        return null;
    }
  };

  /* -----------------------------------------------------------------------
     Render: Quick Add Modal
     ----------------------------------------------------------------------- */

  const renderQuickAddModal = () => {
    if (!quickAddOpen) return null;
    const label = capitalize(quickAddType === 'configuraciones' ? 'configuración' : quickAddType.slice(0, -1));

    let extraFields = null;
    if (quickAddType === 'funcionarios') {
      extraFields = (
        <>
          <div className="form-group">
            <label>Apellido</label>
            <input className="form-control" value={quickAddForm.apellido || ''}
              onChange={(e) => setQuickAddForm((p) => ({ ...p, apellido: e.target.value }))}
              placeholder="Apellidos" />
          </div>
          <div className="form-group">
            <label>Celular</label>
            <input className="form-control" value={quickAddForm.celular || ''}
              onChange={(e) => setQuickAddForm((p) => ({ ...p, celular: e.target.value }))}
              placeholder="Ej: 3001234567" />
          </div>
          <div className="form-group">
            <label>Área</label>
            <SearchableSelect
              value={quickAddForm.id_area || ''}
              onChange={(val) => setQuickAddForm((p) => ({ ...p, id_area: val }))}
              options={aux.areas.map((a) => ({ value: a.id, label: a.nombre_area }))}
            />
          </div>
        </>
      );
    } else if (quickAddType === 'areas') {
      extraFields = (
        <div className="form-group">
          <label>Código</label>
          <input className="form-control" value={quickAddForm.codigo_area || ''}
            onChange={(e) => setQuickAddForm((p) => ({ ...p, codigo_area: e.target.value }))}
            placeholder="Código del área" />
        </div>
      );
    } else if (quickAddType === 'configuraciones') {
      extraFields = (
        <div className="form-group">
          <label>Descripción</label>
          <textarea className="form-control" value={quickAddForm.descripcion || ''}
            onChange={(e) => setQuickAddForm((p) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Descripción" rows={2} />
        </div>
      );
    }

    return (
      <div className="modal-overlay active" onClick={closeQuickAdd}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3><i className="fa-solid fa-plus-circle"></i> Agregar {label}</h3>
            <button className="action-btn" onClick={closeQuickAdd}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>{quickAddType === 'configuraciones' ? 'Configuración (RAM/ROM)' : 'Nombre'} <span className="text-danger">*</span></label>
              <input
                className="form-control"
                value={quickAddForm.nombre || ''}
                onChange={(e) => setQuickAddForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder={quickAddType === 'configuraciones' ? "Ej: 16GB / 512GB" : `Nombre del/la ${label}`}
                autoFocus
              />
            </div>
            {extraFields}
          </div>
          <div className="modal-footer">
            <button className="action-btn" onClick={closeQuickAdd}>
              <i className="fa-solid fa-ban"></i> Cancelar
            </button>
            <button className="btn-save" onClick={handleQuickAddSave} disabled={quickAddLoading}>
              {quickAddLoading ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</>
              ) : (
                <><i className="fa-solid fa-floppy-disk"></i> Guardar</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* -----------------------------------------------------------------------
     Render: CRUD Modal
     ----------------------------------------------------------------------- */

  const renderModal = () => {
    if (!modalOpen) return null;

    return (
      <div className="modal-overlay active" onClick={closeModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
          <div className="modal-header">
            <h3>
              <i className={`fa-solid ${editingItem ? 'fa-pen-to-square' : 'fa-plus-circle'}`}></i>
              {getModalTitle()}
            </h3>
            <button className="action-btn" onClick={closeModal}>
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {renderFormFields()}
          </div>
          <div className="modal-footer">
            <button className="action-btn" onClick={closeModal} style={{ padding: '10px 20px' }}>
              <i className="fa-solid fa-ban"></i> Cancelar
            </button>
            <button className="btn-save" onClick={handleSave} style={{ padding: '10px 20px' }}>
              <i className="fa-solid fa-floppy-disk"></i> {editingItem ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* -----------------------------------------------------------------------
     Render: Data Table
     ----------------------------------------------------------------------- */

  useEffect(() => setPage(1), [pageSize, searchTerm]);

  const renderTable = () => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl" style={{ color: 'var(--primary-color)' }}></i>
          <p style={{ color: 'var(--gray-text)', marginTop: '10px' }}>Cargando datos...</p>
        </div>
      );
    }

    const filteredData = currentData.filter((item) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return Object.values(item).some(
        (val) => val && String(val).toLowerCase().includes(search)
      );
    });
    const displayData = filteredData.slice((page - 1) * pageSize, page * pageSize);

    return (
      <div className="table-wrapper">
        <DataTableControls
          pageSize={pageSize}
          setPageSize={setPageSize}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          totalItems={currentData.length}
          filteredItemsCount={filteredData.length}
        />

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                {showActions && <th className="th-actions">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {displayData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (showActions ? 1 : 0)} className="text-center text-muted py-4">
                    <i className="fa-solid fa-inbox fa-2x mb-2" style={{ display: 'block', color: 'var(--gray-text)' }}></i>
                    No hay registros en esta categoría.
                  </td>
                </tr>
              ) : (
                displayData.map((row, idx) => (
                  <tr key={row.id || idx}>
                    {columns.map((col) => (
                      <td key={col.key}>{renderCellValue(row, col)}</td>
                    ))}
                    {showActions && (
                      <td className="td-actions">
                        {canCrearEditar && (
                          <button
                            className="btn-table btn-table-edit"
                            title="Editar"
                            onClick={() => openEditModal(row, activeTab)}
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                        )}
                        {canEliminar && (
                          <button
                            className="btn-table btn-table-delete"
                            title="Eliminar"
                            onClick={() => handleDelete(row)}
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} setPage={setPage} totalPages={Math.ceil(filteredData.length / pageSize)} totalItems={filteredData.length} pageSize={pageSize} />
      </div>
    );
  };

  /* -----------------------------------------------------------------------
     Render: Floating + button
     ----------------------------------------------------------------------- */

  const renderAddButton = () => {
    if (!canCrearEditar) return null;

    return (
      <div className="fab-container">
        <button className="fab-main">
          <i className="fa-solid fa-plus"></i>
        </button>
        <button className="fab-item" data-tooltip="Tipo" onClick={() => openCreateModal('tipos')}>
          <i className="fa-solid fa-layer-group"></i>
        </button>
        <button className="fab-item" data-tooltip="Marca" onClick={() => openCreateModal('marcas')}>
          <i className="fa-solid fa-tag"></i>
        </button>
        <button className="fab-item" data-tooltip="Área" onClick={() => openCreateModal('areas')}>
          <i className="fa-solid fa-building"></i>
        </button>
        <button className="fab-item" data-tooltip="Configuración" onClick={() => openCreateModal('configuraciones')}>
          <i className="fa-solid fa-memory"></i>
        </button>
        <button className="fab-item" data-tooltip="Funcionario" onClick={() => openCreateModal('funcionarios')}>
          <i className="fa-solid fa-user-tie"></i>
        </button>
        <button className="fab-item" data-tooltip="Otro" onClick={() => openCreateModal('otros')}>
          <i className="fa-solid fa-keyboard"></i>
        </button>
        <button className="fab-item" data-tooltip="Teléfono" onClick={() => openCreateModal('telefonos')}>
          <i className="fa-solid fa-phone"></i>
        </button>
        <button className="fab-item" data-tooltip="Monitor" onClick={() => openCreateModal('monitores')}>
          <i className="fa-solid fa-desktop"></i>
        </button>
        <button className="fab-item" data-tooltip="Escáner/Imp." onClick={() => openCreateModal('impresoras')}>
          <i className="fa-solid fa-print"></i>
        </button>
        <button className="fab-item" data-tooltip="Computador" onClick={() => openCreateModal('equipos')}>
          <i className="fa-solid fa-computer"></i>
        </button>
      </div>
    );
  };

  /* -----------------------------------------------------------------------
     Main Render
     ----------------------------------------------------------------------- */

  return (
    <div className="inventory-module">
      {/* Header */}
      <div className="inventory-header">
        <div className="page-title-row">
          <h2><i className="fa-solid fa-warehouse"></i> Inventario General</h2>
        </div>
      </div>

      {/* Tabs */}
          <div className="inventory-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
            className={`inv-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="inv-tab-content">
        {renderTable()}
      </div>
      {/* CRUD Modal */}
      {renderModal()}

      {/* Quick Add Modal */}
      {renderQuickAddModal()}

      {/* FAB */}
      {renderAddButton()}
    </div>
  );
}
