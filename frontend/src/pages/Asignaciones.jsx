import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { assignmentAPI, auxAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

const INITIAL_ARTICLE = {
  nombre: '', modelo: '', id_marca: '', caracteristicas: '', cantidad_disponible: 1
};

const INITIAL_ASSIGN = {
  id_articulo: '', tipo_destino: '', id_usuario: '', id_area: '', id_equipo: ''
};

export default function Asignaciones() {
  const { permisos } = useAuth();
  const [activeTab, setActiveTab] = useState('inventario');
  const [loading, setLoading] = useState(true);

  // Pagination & Search
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  useEffect(() => setPage(1), [pageSize, globalSearchTerm, activeTab]);

  const [articulos, setArticulos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [equipos, setEquipos] = useState([]);

  // Modales
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editArticle, setEditArticle] = useState(null);
  const [articleForm, setArticleForm] = useState({ ...INITIAL_ARTICLE });
  const [savingArticle, setSavingArticle] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignArt, setAssignArt] = useState(null);
  const [assignForm, setAssignForm] = useState({ ...INITIAL_ASSIGN });
  const [savingAssign, setSavingAssign] = useState(false);

  const [showEditAssignModal, setShowEditAssignModal] = useState(false);
  const [editAssignItem, setEditAssignItem] = useState(null);
  const [editAssignForm, setEditAssignForm] = useState({ id: '', tipo_destino: '', id_usuario: '', id_area: '', id_equipo: '' });
  const [savingEditAssign, setSavingEditAssign] = useState(false);

  // Quick Add Marca
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ nombre: '' });
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // FAB toggle
  const [fabOpen, setFabOpen] = useState(false);

  // Cerrar FAB al hacer click fuera
  useEffect(() => {
    if (!fabOpen) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.fab-container')) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fabOpen]);

  const puedeVer = useMemo(() => permisos?.inv_asignaciones, [permisos]);
  const puedeCrearEditar = useMemo(() => permisos?.inv_crear_editar, [permisos]);

  const loadAll = useCallback(async () => {
    try {
      const [artRes, asigRes] = await Promise.all([
        assignmentAPI.list(),
        assignmentAPI.asignaciones(),
      ]);
      if (artRes.data.success) {
        const d = artRes.data.data || {};
        setArticulos(d.articulos || []);
        setMarcas(d.marcas || []);
        setFuncionarios(d.funcionarios || []);
        setAreas(d.areas || []);
        setEquipos(d.equipos || []);
      }
      if (asigRes.data.success) {
        setAsignaciones(asigRes.data.data || []);
      }
    } catch (err) {
      console.error('Error loading asignaciones data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Escuchar actualizaciones del sistema via SSE
  useEffect(() => {
    const handler = () => loadAll();
    window.addEventListener('rt:system_update', handler);
    return () => window.removeEventListener('rt:system_update', handler);
  }, [loadAll]);

  const getStock = (art) => {
    const disp = parseInt(art.cantidad_disponible, 10) || 0;
    const asig = parseInt(art.cantidad_asignada, 10) || 0;
    return { disponible: disp, asignado: asig, total: disp + asig };
  };

  const getMarcaName = (id) => {
    const m = marcas.find(x => String(x.id) === String(id));
    return m?.nombre_marca || m?.nombre || '-';
  };

  // --- Article CRUD ---
  const openCreateArticle = () => {
    setEditArticle(null);
    setArticleForm({ ...INITIAL_ARTICLE });
    setShowArticleModal(true);
  };

  const openEditArticle = (art) => {
    setEditArticle(art);
    setArticleForm({
      nombre: art.nombre || '',
      modelo: art.modelo || '',
      id_marca: art.id_marca || '',
      caracteristicas: art.caracteristicas || '',
      cantidad_disponible: art.cantidad_disponible || 1,
    });
    setShowArticleModal(true);
  };

  const handleArticleChange = (e) => {
    const { name, value } = e.target;
    setArticleForm(prev => ({ ...prev, [name]: value }));
  };

  const handleArticleSubmit = async (e) => {
    e.preventDefault();
    if (!articleForm.nombre?.trim()) {
      showToast('El nombre del artículo es obligatorio', 'warning');
      return;
    }
    setSavingArticle(true);
    try {
      const payload = {
        id: editArticle?.id || null,
        nombre: articleForm.nombre.trim(),
        modelo: articleForm.modelo?.trim() || '',
        id_marca: articleForm.id_marca || null,
        caracteristicas: articleForm.caracteristicas?.trim() || '',
        cantidad_disponible: parseInt(articleForm.cantidad_disponible, 10) || 0,
      };
      const res = await assignmentAPI.save(payload);
      if (res.data.success) {
        showToast('Artículo guardado exitosamente', 'success');
        setShowArticleModal(false);
        loadAll();
      } else {
        showToast(res.data.message || 'Error al guardar el artículo', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al guardar el artículo', 'error');
    }
    setSavingArticle(false);
  };

  const handleDeleteArticle = async (art) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar artículo?',
      text: `Se eliminará "${art.nombre}". Esta acción no se puede deshacer.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await assignmentAPI.save({ id: art.id, _delete: true });
      if (res.data.success) {
        showToast('Eliminado correctamente', 'success');
        loadAll();
      } else {
        showToast(res.data.message || 'Error al eliminar', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error de conexión', 'error');
    }
  };

  // --- Assign ---
  const openAsignar = (art) => {
    setAssignArt(art);
    setAssignForm({ ...INITIAL_ASSIGN, id_articulo: art ? art.id : '' });
    setShowAssignModal(true);
  };

  const handleAssignChange = (e) => {
    const { name, value } = e.target;
    setAssignForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.id_articulo) {
      showToast('Seleccione un artículo a asignar', 'warning');
      return;
    }
    if (!assignForm.tipo_destino) {
      showToast('Seleccione el tipo de destino', 'warning');
      return;
    }
    const valDestino = assignForm.tipo_destino === 'funcionario' ? assignForm.id_usuario :
                       assignForm.tipo_destino === 'area' ? assignForm.id_area :
                       assignForm.tipo_destino === 'equipo' ? assignForm.id_equipo : null;
    if (!valDestino) {
      showToast('Seleccione el destinatario de la asignación', 'warning');
      return;
    }

    setSavingAssign(true);
    try {
      const payload = {
        id_articulo: assignForm.id_articulo,
        tipo_destino: assignForm.tipo_destino,
        id_usuario: assignForm.tipo_destino === 'funcionario' ? assignForm.id_usuario : null,
        id_area: assignForm.tipo_destino === 'area' ? assignForm.id_area : null,
        id_equipo: assignForm.tipo_destino === 'equipo' ? assignForm.id_equipo : null,
      };
      const res = await assignmentAPI.asignar(payload);
      if (res.data.success) {
        showToast('Asignación realizada con éxito', 'success');
        setShowAssignModal(false);
        loadAll();
      } else {
        showToast(res.data.message || 'Error al realizar asignación', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error de conexión', 'error');
    }
    setSavingAssign(false);
  };

  // --- Edit Assignment ---
  const getTipoDestino = (asig) => {
    if (asig.id_usuario) return 'funcionario';
    if (asig.id_area) return 'area';
    if (asig.id_equipo) return 'equipo';
    return '';
  };

  const openEditAsignacion = (asig) => {
    setEditAssignItem(asig);
    setEditAssignForm({
      id: asig.id,
      tipo_destino: getTipoDestino(asig),
      id_usuario: asig.id_usuario || '',
      id_area: asig.id_area || '',
      id_equipo: asig.id_equipo || ''
    });
    setShowEditAssignModal(true);
  };

  const handleEditAssignSubmit = async (e) => {
    e.preventDefault();
    if (!editAssignForm.tipo_destino) {
      showToast('Seleccione el tipo de destino', 'warning');
      return;
    }
    const valDestino = editAssignForm.tipo_destino === 'funcionario' ? editAssignForm.id_usuario :
                       editAssignForm.tipo_destino === 'area' ? editAssignForm.id_area :
                       editAssignForm.tipo_destino === 'equipo' ? editAssignForm.id_equipo : null;
    if (!valDestino) {
      showToast('Seleccione el nuevo destinatario', 'warning');
      return;
    }

    setSavingEditAssign(true);
    try {
      const payload = {
        id: editAssignForm.id,
        tipo_destino: editAssignForm.tipo_destino,
        id_usuario: editAssignForm.tipo_destino === 'funcionario' ? editAssignForm.id_usuario : null,
        id_area: editAssignForm.tipo_destino === 'area' ? editAssignForm.id_area : null,
        id_equipo: editAssignForm.tipo_destino === 'equipo' ? editAssignForm.id_equipo : null,
      };
      const res = await assignmentAPI.editAsignacion(payload);
      if (res.data.success) {
        showToast('Destino de asignación actualizado', 'success');
        setShowEditAssignModal(false);
        loadAll();
      } else {
        showToast(res.data.message || 'Error al actualizar asignación', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error de conexión', 'error');
    }
    setSavingEditAssign(false);
  };

  const handleUndoAssignment = async (asig) => {
    const confirm = await Swal.fire({
      title: '¿Deshacer asignación?',
      text: `El artículo "${asig.nombre_articulo || ''}" volverá al stock disponible.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshacer',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await assignmentAPI.deleteAsignacion(asig.id);
      if (res.data.success) {
        showToast('Asignación deshecha correctamente', 'success');
        loadAll();
      } else {
        showToast(res.data.message || 'Error al deshacer asignación', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error de conexión', 'error');
    }
  };

  const getNombreDestino = (asig) => {
    if (asig.id_usuario) {
      const f = funcionarios.find(x => String(x.id) === String(asig.id_usuario));
      return f ? `${f.nombre} ${f.apellido}` : asig.nombre_funcionario || `Usuario #${asig.id_usuario}`;
    }
    if (asig.id_area) {
      const a = areas.find(x => String(x.id) === String(asig.id_area));
      return a ? (a.nombre_area || a.nombre) : asig.nombre_area || `Área #${asig.id_area}`;
    }
    if (asig.id_equipo) {
      const e = equipos.find(x => String(x.id) === String(asig.id_equipo));
      return e ? (e.nombre_equipo || e.nombre || e.nombre_completo) : asig.nombre_equipo || `Equipo #${asig.id_equipo}`;
    }
    return '-';
  };

  // --- Quick Add Marca ---
  const openQuickAdd = (type) => {
    setQuickAddForm({ nombre: '' });
    setQuickAddOpen(true);
  };

  const closeQuickAdd = () => {
    setQuickAddOpen(false);
  };

  const handleQuickAddSave = async (e) => {
    e.preventDefault();
    const val = quickAddForm.nombre?.trim();
    if (!val || val.length < 2) {
      showToast('Debe ingresar al menos 2 caracteres.', 'warning');
      return;
    }

    setQuickAddLoading(true);
    try {
      const res = await auxAPI.save({ type: 'marca', nombre: val });
      if (res.data.success) {
        showToast('Marca creada correctamente', 'success');
        const marcasRes = await auxAPI.marcas();
        if (marcasRes.data.success) {
          setMarcas(marcasRes.data.data || []);
        }
        closeQuickAdd();
      } else {
        showToast(res.data.message || 'No se pudo crear la marca', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al guardar la marca', 'error');
    }
    setQuickAddLoading(false);
  };

  // --- Guards ---
  if (!puedeVer) {
    return (
      <div className="inventory-module" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="text-center" style={{ color: 'var(--text-color)' }}>
          <i className="fa-solid fa-ban" style={{ fontSize: '48px', color: 'var(--gray-text)', marginBottom: '20px' }}></i>
          <h2>Acceso Restringido</h2>
          <p style={{ color: 'var(--gray-text)' }}>No tienes permisos para este módulo.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="inventory-module" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: 'var(--primary-color)' }}></i>
      </div>
    );
  }

  return (
    <div className="inventory-module">
      <div className="inventory-header">
        <div className="page-title-row">
          <h2><i className="fa-solid fa-dolly"></i> Asignaciones y Repuestos</h2>
        </div>
      </div>

      <div className="inventory-tabs">
        <button className={`inv-tab ${activeTab === 'inventario' ? 'active' : ''}`} onClick={() => setActiveTab('inventario')}>
          <i className="fa-solid fa-boxes-stacked"></i> Inventario de Repuestos
        </button>
        <button className={`inv-tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
          <i className="fa-solid fa-clock-rotate-left"></i> Historial de Asignaciones
        </button>
      </div>

      <div className="inv-tab-content">
        {activeTab === 'inventario' && (
          <div className="table-wrapper">
            <DataTableControls
              pageSize={pageSize}
              setPageSize={setPageSize}
              searchTerm={globalSearchTerm}
              setSearchTerm={setGlobalSearchTerm}
              totalItems={articulos.length}
              filteredItemsCount={articulos.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length}
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>Marca / Modelo</th>
                    <th>Características</th>
                    <th className="text-center" style={{ width: '160px' }}>Stock</th>
                    <th className="td-actions" style={{ width: '120px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = articulos.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase())));
                    const display = filtered.slice((page - 1) * pageSize, page * pageSize);
                    if (display.length === 0) {
                      return (
                        <tr>
                          <td colSpan="5" className="text-center p-4" style={{ color: 'var(--gray-text)' }}>
                            <i className="fa-solid fa-box-open" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                            No hay artículos registrados
                          </td>
                        </tr>
                      );
                    }
                    return display.map(art => {
                      const { disponible, asignado } = getStock(art);
                      return (
                        <tr key={art.id}>
                          <td><strong>{art.nombre}</strong></td>
                          <td>
                            {getMarcaName(art.id_marca)}
                            <br />
                            <small className="text-gray-text">{art.modelo || '-'}</small>
                          </td>
                          <td><small style={{ color: 'var(--gray-text)' }}>{art.caracteristicas || '-'}</small></td>
                          <td className="text-center">
                            <span className={`badge-role ${disponible > 0 ? 'avanzado' : 'administrador'}`} title="Disponible" style={{ marginRight: '6px' }}>
                              <i className="fa-solid fa-box" style={{ marginRight: '4px' }}></i> {disponible}
                            </span>
                            <span className="badge-role consulta" title="Asignados">
                              <i className="fa-solid fa-user-check" style={{ marginRight: '4px' }}></i> {asignado}
                            </span>
                          </td>
                          <td className="td-actions">
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              {puedeCrearEditar && (
                                <>
                                  {disponible > 0 && (
                                    <button className="btn-table" title="Asignar" onClick={() => openAsignar(art)}
                                      style={{ background: 'rgba(74,108,247,0.1)', color: 'var(--primary-color)', borderRadius: '8px', padding: '6px 10px' }}>
                                      <i className="fa-solid fa-hand-holding-hand"></i>
                                    </button>
                                  )}
                                  <button className="btn-table btn-table-edit" title="Editar" onClick={() => openEditArticle(art)}>
                                    <i className="fa-solid fa-pen"></i>
                                  </button>
                                  <button className="btn-table btn-table-delete" title="Eliminar" onClick={() => handleDeleteArticle(art)}>
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <Pagination page={page} setPage={setPage} totalPages={Math.ceil(articulos.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length / pageSize)} totalItems={articulos.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length} pageSize={pageSize} />
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="table-wrapper">
            <DataTableControls
              pageSize={pageSize}
              setPageSize={setPageSize}
              searchTerm={globalSearchTerm}
              setSearchTerm={setGlobalSearchTerm}
              totalItems={asignaciones.length}
              filteredItemsCount={asignaciones.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length}
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Artículo</th>
                    <th>Asignado A</th>
                    <th>Tipo</th>
                    <th className="td-actions" style={{ width: '100px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = asignaciones.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase())));
                    const display = filtered.slice((page - 1) * pageSize, page * pageSize);
                    if (display.length === 0) {
                      return (
                        <tr>
                          <td colSpan="5" className="text-center p-4" style={{ color: 'var(--gray-text)' }}>
                            <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                            No hay asignaciones registradas
                          </td>
                        </tr>
                      );
                    }
                    return display.map(asig => (
                      <tr key={asig.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {asig.fecha_asignacion ? new Date(asig.fecha_asignacion).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td>
                          <strong>{asig.nombre_articulo || asig.nombre || '-'}</strong>
                          <br />
                          <small className="text-gray-text">{asig.modelo || '-'}</small>
                        </td>
                        <td>
                          {asig.id_usuario ? (
                            <>
                              <i className="fa-solid fa-user" style={{ marginRight: '6px', color: 'var(--gray-text)' }}></i>
                              {getNombreDestino(asig)}
                            </>
                          ) : asig.id_area ? (
                            <>
                              <i className="fa-solid fa-building" style={{ marginRight: '6px', color: 'var(--gray-text)' }}></i>
                              {getNombreDestino(asig)}
                            </>
                          ) : asig.id_equipo ? (
                            <>
                              <i className="fa-solid fa-computer" style={{ marginRight: '6px', color: 'var(--gray-text)' }}></i>
                              {getNombreDestino(asig)}
                            </>
                          ) : (
                            <span style={{ color: 'red' }}>Desconocido</span>
                          )}
                        </td>
                        <td>
                          {asig.id_usuario ? 'Personal' : asig.id_area ? 'Área' : asig.id_equipo ? 'Equipo' : '-'}
                        </td>
                        <td className="td-actions">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {puedeCrearEditar && (
                              <>
                                <button className="btn-table btn-table-edit" title="Cambiar destino" onClick={() => openEditAsignacion(asig)}>
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                                <button className="btn-table" title="Deshacer (Regresar a Stock)" onClick={() => handleUndoAssignment(asig)}
                                  style={{ background: 'rgba(255,193,7,0.1)', color: '#856404', borderRadius: '8px', padding: '6px 10px' }}>
                                  <i className="fa-solid fa-rotate-left"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <Pagination page={page} setPage={setPage} totalPages={Math.ceil(asignaciones.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length / pageSize)} totalItems={asignaciones.filter(a => !globalSearchTerm || Object.values(a).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length} pageSize={pageSize} />
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) Menu */}
      {puedeCrearEditar && (
        <div className={`fab-container${fabOpen ? ' active' : ''}`}>
          <button
            className={`fab-main${fabOpen ? ' active' : ''}`}
            onClick={() => setFabOpen(o => !o)}
            aria-label="Abrir menú de acciones"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          <button className="fab-item" data-tooltip="Asignar" onClick={() => openAsignar(null)}>
            <i className="fa-solid fa-hand-holding-hand"></i>
          </button>
          <button className="fab-item" data-tooltip="Nuevo Repuesto" onClick={openCreateArticle}>
            <i className="fa-solid fa-boxes-packing"></i>
          </button>
        </div>
      )}

      {/* MODAL: Article */}
      {showArticleModal && (
        <div className="modal-overlay active" onClick={() => setShowArticleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                <i className="fa-solid fa-box" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                {editArticle ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h3>
              <button className="action-btn" onClick={() => setShowArticleModal(false)} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleArticleSubmit}>
              <div className="modal-body" style={{ padding: '25px' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" name="nombre" value={articleForm.nombre} onChange={handleArticleChange} placeholder="Nombre del artículo" required />
                  </div>
                  <div className="form-group">
                    <label>Modelo</label>
                    <input type="text" className="form-control" name="modelo" value={articleForm.modelo} onChange={handleArticleChange} placeholder="Modelo" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Marca</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <SearchableSelect
                          value={articleForm.id_marca}
                          onChange={(val) => setArticleForm(p => ({ ...p, id_marca: val }))}
                          options={marcas.map(m => ({ value: m.id, label: m.nombre_marca || m.nombre }))}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-quick-add"
                        title="Agregar Marca"
                        onClick={() => openQuickAdd('marca')}
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
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Stock Disponible <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" name="cantidad_disponible" value={articleForm.cantidad_disponible} onChange={handleArticleChange} min="0" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Características</label>
                  <input type="text" className="form-control" name="caracteristicas" value={articleForm.caracteristicas} onChange={handleArticleChange} placeholder="Ej: DDR4 16GB 3200MHz" />
                </div>
              </div>
              <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--input-bg)' }}>
                <button type="button" className="action-btn" onClick={() => setShowArticleModal(false)} style={{ padding: '10px 20px' }}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={savingArticle} style={{ padding: '10px 20px' }}>
                  {savingArticle ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-floppy-disk"></i> {editArticle ? 'Actualizar' : 'Crear'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Assign */}
      {showAssignModal && (
        <div className="modal-overlay active" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                <i className="fa-solid fa-hand-holding-hand" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                Asignar Artículo
              </h3>
              <button className="action-btn" onClick={() => setShowAssignModal(false)} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="modal-body" style={{ padding: '25px' }}>
                <div className="form-group">
                  <label>Artículo a Asignar <span className="text-danger">*</span></label>
                  <SearchableSelect
                    value={assignForm.id_articulo}
                    onChange={(val) => setAssignForm(p => ({ ...p, id_articulo: val }))}
                    options={articulos.filter(a => getStock(a).disponible > 0 || String(a.id) === String(assignForm.id_articulo)).map(art => ({
                      value: art.id,
                      label: `${art.nombre}${art.nombre_marca ? ' - ' + art.nombre_marca : ''}${art.modelo ? ' ' + art.modelo : ''} (${getStock(art).disponible} disp)`
                    }))}
                  />
                </div>
                <div className="form-group">
                  <label>Asignar a: <span className="text-danger">*</span></label>
                  <select
                    className="form-control"
                    name="tipo_destino"
                    value={assignForm.tipo_destino}
                    onChange={(e) => setAssignForm(p => ({ ...p, tipo_destino: e.target.value, id_usuario: '', id_area: '', id_equipo: '' }))}
                    required
                  >
                    <option value="">Seleccione...</option>
                    <option value="funcionario">Funcionario</option>
                    <option value="area">Área</option>
                    <option value="equipo">Equipo</option>
                  </select>
                </div>
                {assignForm.tipo_destino === 'funcionario' && (
                  <div className="form-group">
                    <label>Funcionario <span className="text-danger">*</span></label>
                    <SearchableSelect
                      value={assignForm.id_usuario}
                      onChange={(val) => setAssignForm(p => ({ ...p, id_usuario: val }))}
                      options={funcionarios.map(f => ({ value: f.id, label: `${f.nombre} ${f.apellido}` }))}
                    />
                  </div>
                )}
                {assignForm.tipo_destino === 'area' && (
                  <div className="form-group">
                    <label>Área <span className="text-danger">*</span></label>
                    <SearchableSelect
                      value={assignForm.id_area}
                      onChange={(val) => setAssignForm(p => ({ ...p, id_area: val }))}
                      options={areas.map(a => ({ value: a.id, label: a.nombre_area || a.nombre }))}
                    />
                  </div>
                )}
                {assignForm.tipo_destino === 'equipo' && (
                  <div className="form-group">
                    <label>Equipo <span className="text-danger">*</span></label>
                    <SearchableSelect
                      value={assignForm.id_equipo}
                      onChange={(val) => setAssignForm(p => ({ ...p, id_equipo: val }))}
                      options={equipos.map(e => ({ value: e.id, label: `${e.nombre_equipo || e.nombre || ''} - ${e.serial || ''}` }))}
                    />
                  </div>
                )}
              </div>
              <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--input-bg)' }}>
                <button type="button" className="action-btn" onClick={() => setShowAssignModal(false)} style={{ padding: '10px 20px' }}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={savingAssign} style={{ padding: '10px 20px' }}>
                  {savingAssign ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Asignando...</> : <><i className="fa-solid fa-check"></i> Asignar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Assignment */}
      {showEditAssignModal && (
        <div className="modal-overlay active" onClick={() => setShowEditAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                Editar Asignación
              </h3>
              <button className="action-btn" onClick={() => setShowEditAssignModal(false)} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleEditAssignSubmit}>
              <div className="modal-body" style={{ padding: '25px' }}>
                <div className="form-group">
                  <label>Cambiar Destino a: <span className="text-danger">*</span></label>
                  <select
                    className="form-control"
                    name="tipo_destino"
                    value={editAssignForm.tipo_destino}
                    onChange={(e) => setEditAssignForm(p => ({ ...p, tipo_destino: e.target.value, id_usuario: '', id_area: '', id_equipo: '' }))}
                    required
                  >
                    <option value="">Seleccione...</option>
                    <option value="funcionario">Funcionario</option>
                    <option value="area">Área</option>
                    <option value="equipo">Equipo</option>
                  </select>
                </div>
                {editAssignForm.tipo_destino === 'funcionario' && (
                  <div className="form-group">
                    <label>Funcionario <span className="text-danger">*</span></label>
                    <SearchableSelect
                      value={editAssignForm.id_usuario}
                      onChange={(val) => setEditAssignForm(p => ({ ...p, id_usuario: val }))}
                      options={funcionarios.map(f => ({ value: f.id, label: `${f.nombre} ${f.apellido}` }))}
                    />
                  </div>
                )}
                {editAssignForm.tipo_destino === 'area' && (
                  <div className="form-group">
                    <label>Área <span className="text-danger">*</span></label>
                    <SearchableSelect
                      value={editAssignForm.id_area}
                      onChange={(val) => setEditAssignForm(p => ({ ...p, id_area: val }))}
                      options={areas.map(a => ({ value: a.id, label: a.nombre_area || a.nombre }))}
                    />
                  </div>
                )}
                {editAssignForm.tipo_destino === 'equipo' && (
                  <div className="form-group">
                    <label>Equipo <span className="text-danger">*</span></label>
                    <SearchableSelect
                      value={editAssignForm.id_equipo}
                      onChange={(val) => setEditAssignForm(p => ({ ...p, id_equipo: val }))}
                      options={equipos.map(e => ({ value: e.id, label: `${e.nombre_equipo || e.nombre || ''} - ${e.serial || ''}` }))}
                    />
                  </div>
                )}
              </div>
              <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--input-bg)' }}>
                <button type="button" className="action-btn" onClick={() => setShowEditAssignModal(false)} style={{ padding: '10px 20px' }}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={savingEditAssign} style={{ padding: '10px 20px' }}>
                  {savingEditAssign ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-floppy-disk"></i> Actualizar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quick Add Marca */}
      {quickAddOpen && (
        <div className="modal-overlay active" onClick={closeQuickAdd} style={{ zIndex: 2100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                <i className="fa-solid fa-plus-circle" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                Agregar Marca
              </h3>
              <button className="action-btn" onClick={closeQuickAdd} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleQuickAddSave}>
              <div className="modal-body" style={{ padding: '25px' }}>
                <div className="form-group">
                  <label>Nombre de la Marca <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={quickAddForm.nombre}
                    onChange={(e) => setQuickAddForm({ nombre: e.target.value })}
                    placeholder="Ej: HP, Lenovo"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--input-bg)' }}>
                <button type="button" className="action-btn" onClick={closeQuickAdd} style={{ padding: '10px 20px' }}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={quickAddLoading} style={{ padding: '10px 20px' }}>
                  {quickAddLoading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-floppy-disk"></i> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
