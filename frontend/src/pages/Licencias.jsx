import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { licenseAPI, auxAPI } from '../api/client';
import { showToast, showConfirm } from '../core/toast';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

const SOFTWARE_PREDEFINIDO = [
  'Office 2010','Office 2013','Office 2016','Office 2019','Office 2021','Office 2024','Office 365',
  'Windows 10','Windows 11',
  'Adobe Acrobat Reader','Adobe Acrobat Pro','Adobe Acrobat Standard',
  'Antivirus Avast','Antivirus Norton','Antivirus McAfee','Antivirus Kaspersky','Antivirus ESET',
  'Autocad','SolidWorks','SAP','Photoshop','Illustrator',
  'Visual Studio Code','Visual Studio','SQL Server','MySQL','PostgreSQL',
  'TeamViewer','AnyDesk','Zoom','Teams','Slack'
];

export default function Licencias() {
  const { hasPermission } = useAuth();

  const [licencias, setLicencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todas');
  const [visibleSerials, setVisibleSerials] = useState({});

  // Pagination & Search
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  useEffect(() => setPage(1), [pageSize, globalSearchTerm]);

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({
    nombre_software: '', tipo_edicion: '', serial_key: '', id_area: '', id_equipo: ''
  });
  const [guardando, setGuardando] = useState(false);

  const [areas, setAreas] = useState([]);
  const [equipos, setEquipos] = useState([]);

  // ─── Cargar datos ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [licRes, listasRes] = await Promise.all([
        licenseAPI.list(),
        licenseAPI.listas(),
      ]);
      if (licRes.data?.success) {
        const d = licRes.data.data || {};
        setLicencias(d.licencias || []);
        if (d.areas) setAreas(d.areas);
        if (d.equipos) setEquipos(d.equipos);
      }
      if (listasRes.data?.success) {
        const ld = listasRes.data.data || {};
        if (ld.areas) setAreas(ld.areas);
        if (ld.equipos) setEquipos(ld.equipos);
      }
    } catch (err) {
      console.error('Error cargando licencias:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Escuchar actualizaciones del sistema via SSE
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('rt:system_update', handler);
    return () => window.removeEventListener('rt:system_update', handler);
  }, [loadData]);

  // Shortcut Alt+Shift+N → abrir modal de nueva licencia
  useEffect(() => {
    const handler = () => {
      if (hasPermission('inv_crear_editar')) openCreate();
    };
    window.addEventListener('shortcut:new', handler);
    return () => window.removeEventListener('shortcut:new', handler);
  }, []);

  // ─── Tabs dinámicos ───────────────────────────────────────────
  const softwareGroups = useMemo(() => {
    const groups = {};
    licencias.forEach(lic => {
      const name = lic.nombre_software || 'Sin nombre';
      if (!groups[name]) groups[name] = [];
      groups[name].push(lic);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [licencias]);

  const filtered = useMemo(() => {
    if (activeTab === 'todas') return licencias;
    return licencias.filter(l => l.nombre_software === activeTab);
  }, [licencias, activeTab]);

  // ─── Serial helpers ──────────────────────────────────────────
  const maskSerial = (key) => {
    if (!key) return '—';
    if (key.length <= 4) return '*'.repeat(key.length);
    return '*'.repeat(key.length - 4) + key.slice(-4);
  };

  const toggleSerial = (id) => {
    setVisibleSerials(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── Modal ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditando(null);
    setFormData({ nombre_software: '', tipo_edicion: '', serial_key: '', id_area: '', id_equipo: '' });
    setShowModal(true);
  };

  const openEdit = (lic) => {
    setEditando(lic);
    setFormData({
      nombre_software: lic.nombre_software || '',
      tipo_edicion: lic.tipo_edicion || '',
      serial_key: lic.serial_key || '',
      id_area: lic.id_area || '',
      id_equipo: lic.id_equipo || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.nombre_software?.trim()) {
      showToast('El nombre del software es obligatorio', 'warning');
      return;
    }
    if (!formData.serial_key?.trim()) {
      showToast('El serial o clave de licencia es obligatorio', 'warning');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre_software: formData.nombre_software.trim(),
        tipo_edicion: formData.tipo_edicion.trim(),
        serial_key: formData.serial_key.trim(),
        id_area: formData.id_area || null,
        id_equipo: formData.id_equipo || null,
      };
      let res;
      if (editando) {
        res = await licenseAPI.update({ id: editando.id, ...payload });
      } else {
        res = await licenseAPI.create(payload);
      }
      if (res.data?.success) {
        showToast(editando ? 'Licencia actualizada correctamente' : 'Licencia creada correctamente', 'success');
        closeModal();
        loadData();
      } else {
        showToast(res.data?.message || 'Error al guardar la licencia', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
    setGuardando(false);
  };

  const handleDelete = async (lic) => {
    const result = await showConfirm({
      title: '¿Eliminar licencia?',
      text: `${lic.nombre_software} ${lic.tipo_edicion || ''}`.trim(),
      icon: 'warning',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmVariant: 'danger',
    });
    if (result.isConfirmed) {
      try {
        const res = await licenseAPI.delete(lic.id);
        if (res.data?.success) {
          showToast('Licencia eliminada correctamente', 'success');
          loadData();
        } else {
          showToast('Error al eliminar la licencia', 'error');
        }
      } catch (err) {
        showToast('Error de conexión', 'error');
      }
    }
  };

  const getCount = (name) => licencias.filter(l => l.nombre_software === name).length;

  // ─── Render ───────────────────────────────────────────────────
  if (!hasPermission('inv_licencias')) {
    return (
      <div className="inventory-module" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="text-center">
          <i className="fa-solid fa-key" style={{ fontSize: '48px', color: 'var(--gray-text)', marginBottom: '20px' }}></i>
          <h2>Acceso Restringido</h2>
          <p style={{ color: 'var(--gray-text)' }}>No tienes permiso para este módulo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-module">
      <div className="inventory-header">
        <div className="page-title-row">
          <h2><i className="fa-solid fa-key"></i> Licencias de Software</h2>
        </div>
      </div>

      <div className="inventory-tabs">
        <button className={`inv-tab ${activeTab === 'todas' ? 'active' : ''}`} onClick={() => setActiveTab('todas')}>
          <i className="fa-solid fa-layer-group"></i> Todas
          <span className="ui-pill pill-slate" style={{ marginLeft: '6px', padding: '1px 7px', fontSize: '0.7rem' }}>{licencias.length}</span>
        </button>
        {softwareGroups.map(([name]) => (
          <button key={name} className={`inv-tab ${activeTab === name ? 'active' : ''}`} onClick={() => setActiveTab(name)}>
            <i className="fa-solid fa-cube"></i> {name}
            <span className="ui-pill pill-slate" style={{ marginLeft: '6px', padding: '1px 7px', fontSize: '0.7rem' }}>{getCount(name)}</span>
          </button>
        ))}
      </div>

      <div className="inv-tab-content">
        {loading ? (
          <div className="text-center p-4"><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '28px', color: 'var(--primary-color)' }}></i></div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-4" style={{ color: 'var(--gray-text)' }}>
            <i className="fa-solid fa-key" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}></i>
            No hay licencias registradas
          </div>
        ) : (
          <div className="table-wrapper">
            <DataTableControls
              pageSize={pageSize}
              setPageSize={setPageSize}
              searchTerm={globalSearchTerm}
              setSearchTerm={setGlobalSearchTerm}
              totalItems={filtered.length}
              filteredItemsCount={filtered.filter(l => !globalSearchTerm || Object.values(l).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length}
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Software</th>
                    <th>Edición</th>
                    <th>Serial Key</th>
                    <th>Área</th>
                    <th>Equipo</th>
                    <th className="td-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const finalData = filtered.filter(l => !globalSearchTerm || Object.values(l).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase())));
                    const display = finalData.slice((page - 1) * pageSize, page * pageSize);
                    if (display.length === 0) return <tr><td colSpan="6" className="text-center p-4">No se encontraron licencias</td></tr>;
                    return display.map(lic => (
                      <tr key={lic.id}>
                        <td><strong>{lic.nombre_software || '—'}</strong></td>
                        <td>
                          {lic.tipo_edicion ? (
                            <span className="ui-pill pill-blue">{lic.tipo_edicion}</span>
                          ) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <code style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', background: 'var(--input-bg)', border: '1px solid var(--border-color)', padding: '3px 10px', borderRadius: '6px', color: 'var(--text-color)' }}>
                              {visibleSerials[lic.id] ? lic.serial_key : maskSerial(lic.serial_key)}
                            </code>
                            <button className="btn-table" title={visibleSerials[lic.id] ? 'Ocultar' : 'Mostrar'} onClick={() => toggleSerial(lic.id)}>
                              <i className={`fa-solid ${visibleSerials[lic.id] ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                            </button>
                          </div>
                        </td>
                        <td>{lic.nombre_area || '—'}</td>
                        <td>{lic.nombre_equipo || '—'}</td>
                        <td className="td-actions">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {hasPermission('inv_crear_editar') && (
                              <button className="btn-table btn-table-edit" title="Editar" onClick={() => openEdit(lic)}>
                                <i className="fa-solid fa-pen"></i>
                              </button>
                            )}
                            {hasPermission('inv_eliminar') && (
                              <button className="btn-table btn-table-delete" title="Eliminar" onClick={() => handleDelete(lic)}>
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <Pagination page={page} setPage={setPage} totalPages={Math.ceil(filtered.filter(l => !globalSearchTerm || Object.values(l).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length / pageSize)} totalItems={filtered.length} pageSize={pageSize} />
          </div>
        )}
      </div>

      {/* Floating + */}
      {hasPermission('inv_crear_editar') && (
        <button className="inv-add-btn" onClick={openCreate} title="Nueva Licencia">
          <i className="fa-solid fa-plus"></i>
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay active" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-key" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                {editando ? 'Editar Licencia' : 'Nueva Licencia'}
              </h3>
              <button type="button" className="btn-icon btn-ghost" onClick={closeModal}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Software <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" name="nombre_software" value={formData.nombre_software} onChange={handleChange} placeholder="Ej: Office 2021" list="sw-list" />
                  <datalist id="sw-list">
                    {SOFTWARE_PREDEFINIDO.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Edición</label>
                  <input type="text" className="form-control" name="tipo_edicion" value={formData.tipo_edicion} onChange={handleChange} placeholder="Ej: Pro, Home" list="ed-list" />
                  <datalist id="ed-list">
                    {['Home','Pro','Enterprise','Standard','Professional','Ultimate','Premium'].map(e => <option key={e} value={e} />)}
                  </datalist>
                </div>
              </div>
              <div className="form-group">
                <label>Serial Key <span className="text-danger">*</span></label>
                <input type="text" className="form-control" name="serial_key" value={formData.serial_key} onChange={handleChange} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Área</label>
                  <SearchableSelect
                    value={formData.id_area}
                    onChange={(val) => setFormData(p => ({ ...p, id_area: val }))}
                    options={areas.map(a => ({ value: a.id, label: a.nombre_area }))}
                  />
                </div>
                <div className="form-group">
                  <label>Equipo asignado</label>
                  <SearchableSelect
                    value={formData.id_equipo}
                    onChange={(val) => setFormData(p => ({ ...p, id_equipo: val }))}
                    options={equipos.map(e => ({ value: e.id, label: e.nombre_equipo }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={guardando}>
                {guardando ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-floppy-disk"></i> {editando ? 'Actualizar' : 'Guardar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
