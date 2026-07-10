import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { bajasAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

const CATEGORIAS_INSUMO = [
  'TECLADO','MOUSE','DIADEMA','RAM','DISCO','CARGADOR','CABLE','OTRO'
];

export default function Bajas() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('individuales');
  const [loading, setLoading] = useState(true);
  const [bajasList, setBajasList] = useState([]);
  const [consolidatedList, setConsolidatedList] = useState([]);

  // Pagination and filtering
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  useEffect(() => setPage(1), [pageSize, globalSearchTerm, activeTab]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [tipoElemento, setTipoElemento] = useState('activo');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [formData, setFormData] = useState({
    // Activo
    categoria: '', marca: '', modelo: '', serial: '', serial_interno: '',
    // Insumo
    categoria_insumo: 'OTRO', marca_insumo: '', cantidad: 1,
    // Ambos
    motivo: '',
  });
  const [saving, setSaving] = useState(false);
  const searchTimeout = useRef(null);

  const puedeEliminar = hasPermission('inv_eliminar');
  const puedeVer = hasPermission('inv_bajas');

  // ─── Load data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [listRes, conRes] = await Promise.all([
        bajasAPI.list(),
        bajasAPI.consolidated(),
      ]);
      if (listRes.data?.success) setBajasList(listRes.data.data || []);
      if (conRes.data?.success) setConsolidatedList(conRes.data.data || []);
    } catch (err) {
      console.error('Error cargando bajas:', err);
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

  // Shortcut Alt+Shift+N → abrir modal de registrar baja
  useEffect(() => {
    const handler = () => {
      if (puedeEliminar) openModal();
    };
    window.addEventListener('shortcut:new', handler);
    return () => window.removeEventListener('shortcut:new', handler);
  }, [puedeEliminar]);

  // ─── Search asset ──────────────────────────────────────────
  const handleSearch = (q) => {
    setSearchTerm(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 3) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await bajasAPI.search(q);
        if (res.data?.success) setSearchResults(res.data.data || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  };

  const selectAsset = (asset) => {
    setSelectedAsset(asset);
    setManualMode(false);
    setFormData(prev => ({
      ...prev,
      categoria: asset.nombre || '',
      marca: asset.nombre_marca || '',
      modelo: asset.modelo || '',
      serial: asset.serial || '',
      serial_interno: asset.serial_interno || '',
    }));
    setSearchResults([]);
    setSearchTerm('');
  };

  const enableManualMode = () => {
    setSelectedAsset(null);
    setManualMode(true);
    setFormData(prev => ({
      ...prev, categoria: '', marca: '', modelo: '', serial: '', serial_interno: '',
    }));
    setSearchResults([]);
    setSearchTerm('');
  };

  // ─── Save ──────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.motivo?.trim() || formData.motivo.trim().length < 10) {
      showToast('El mensaje debe tener al menos 6 caracteres', 'warning');
    }

    const confirmMsg = selectedAsset
      ? '¿Confirmar baja? El activo se marcará como "De baja" y desaparecerá del inventario activo.'
      : '¿Confirmar registro de baja manual?';

    const confirmed = await Swal.fire({
      title: '¿Procesar baja?', text: confirmMsg, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Sí, procesar',
    });
    if (!confirmed.isConfirmed) return;

    setSaving(true);
    try {
      let payload;
      if (tipoElemento === 'insumo') {
        payload = {
          tipo_form: 'insumo',
          categoria_insumo: formData.categoria_insumo,
          marca_insumo: formData.marca_insumo || 'Genérico',
          cantidad: parseInt(formData.cantidad, 10) || 1,
          motivo: formData.motivo.trim(),
        };
      } else if (selectedAsset) {
        payload = {
          tipo_form: 'existente',
          origen_tabla: selectedAsset.source || 'equipos_de_computo',
          origen_id: selectedAsset.id,
          categoria: selectedAsset.nombre || '',
          marca: formData.marca,
          modelo: formData.modelo,
          serial: formData.serial,
          serial_interno: formData.serial_interno,
          motivo: formData.motivo.trim(),
        };
      } else {
        payload = {
          tipo_form: 'manual_activo',
          categoria: formData.categoria,
          marca: formData.marca,
          modelo: formData.modelo,
          serial: formData.serial,
          serial_interno: formData.serial_interno,
          motivo: formData.motivo.trim(),
        };
      }

      const res = await bajasAPI.save(payload);
      if (res.data?.success) {
        showToast('Baja registrada', 'success');
        setShowModal(false);
        resetForm();
        loadData();
      } else {
        showToast('Error de conexión', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setSelectedAsset(null);
    setManualMode(false);
    setSearchTerm('');
    setSearchResults([]);
    setTipoElemento('activo');
    setFormData({
      categoria: '', marca: '', modelo: '', serial: '', serial_interno: '',
      categoria_insumo: 'OTRO', marca_insumo: '', cantidad: 1, motivo: '',
    });
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  // ─── Guards ────────────────────────────────────────────────
  if (!puedeVer) {
    return (
      <div className="inventory-module" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="text-center">
          <i className="fa-solid fa-skull-crossbones" style={{ fontSize: '48px', color: 'var(--gray-text)', marginBottom: '20px' }}></i>
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
          <h2><i className="fa-solid fa-skull-crossbones"></i> Archivo de Bajas</h2>
        </div>
      </div>

      <div className="inventory-tabs">
        <button className={`inv-tab ${activeTab === 'individuales' ? 'active' : ''}`} onClick={() => setActiveTab('individuales')}>
          <i className="fa-solid fa-list-ol"></i> Bajas Individuales
        </button>
        <button className={`inv-tab ${activeTab === 'consolidado' ? 'active' : ''}`} onClick={() => setActiveTab('consolidado')}>
          <i className="fa-solid fa-layer-group"></i> Insumos Consolidados
        </button>
      </div>

      <div className="inv-tab-content">
        {loading ? (
          <div className="text-center p-4"><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '28px', color: 'var(--primary-color)' }}></i></div>
        ) : activeTab === 'individuales' ? (
          <div className="table-wrapper">
            <DataTableControls
              pageSize={pageSize}
              setPageSize={setPageSize}
              searchTerm={globalSearchTerm}
              setSearchTerm={setGlobalSearchTerm}
              totalItems={bajasList.length}
              filteredItemsCount={
                bajasList.filter(b => !globalSearchTerm || Object.values(b).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length
              }
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo / Categoría</th>
                    <th>Detalle (Marca/Modelo)</th>
                    <th>Serial / S.Int</th>
                    <th>Motivo</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = bajasList.filter(b => !globalSearchTerm || Object.values(b).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase())));
                    const display = filtered.slice((page - 1) * pageSize, page * pageSize);
                    if (display.length === 0) return <tr><td colSpan="6" className="text-center p-4" style={{ color: 'var(--gray-text)' }}>Sin registros de bajas</td></tr>;
                    return display.map(b => (
                      <tr key={b.id}>
                        <td>{b.fecha_baja ? new Date(b.fecha_baja).toLocaleDateString('es-CO') : '-'}</td>
                        <td><strong>{b.tipo_activo || '-'}</strong><br /><small style={{ color: 'var(--gray-text)' }}>{b.categoria || ''}</small></td>
                        <td>{(b.marca || '') + ' ' + (b.modelo || '')}</td>
                        <td>
                          {b.serial || '-'}
                          {b.serial_interno ? <><br /><small style={{ color: 'var(--gray-text)' }}>Int: {b.serial_interno}</small></> : ''}
                        </td>
                        <td style={{ maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{b.motivo || ''}</td>
                        <td>{b.username || b.responsable_nombre || '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <Pagination page={page} setPage={setPage} totalPages={Math.ceil(bajasList.filter(b => !globalSearchTerm || Object.values(b).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length / pageSize)} totalItems={bajasList.filter(b => !globalSearchTerm || Object.values(b).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length} pageSize={pageSize} />
          </div>
        ) : (
          <div className="table-wrapper">
            <div style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--gray-text)', borderBottom: '1px solid var(--border-color)' }}>
              <i className="fa-solid fa-info-circle"></i> Sumatoria de bajas de elementos genéricos/insumos.
            </div>
            <DataTableControls
              pageSize={pageSize}
              setPageSize={setPageSize}
              searchTerm={globalSearchTerm}
              setSearchTerm={setGlobalSearchTerm}
              totalItems={consolidatedList.length}
              filteredItemsCount={
                consolidatedList.filter(c => !globalSearchTerm || Object.values(c).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length
              }
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Marca</th>
                    <th>Total Bajas</th>
                    <th>Último Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = consolidatedList.filter(c => !globalSearchTerm || Object.values(c).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase())));
                    const display = filtered.slice((page - 1) * pageSize, page * pageSize);
                    if (display.length === 0) return <tr><td colSpan="4" className="text-center p-4" style={{ color: 'var(--gray-text)' }}>Sin datos consolidados</td></tr>;
                    return display.map((c, i) => (
                      <tr key={i}>
                        <td><strong>{c.categoria || ''}</strong></td>
                        <td>{c.marca || 'Genérico'}</td>
                        <td style={{ color: '#dc3545', fontWeight: 700 }}>{c.total || c.cantidad_total || 0}</td>
                        <td style={{ color: 'var(--gray-text)' }}>{c.ultimo || c.ultima ? new Date(c.ultimo || c.ultima).toLocaleDateString('es-CO') : '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <Pagination page={page} setPage={setPage} totalPages={Math.ceil(consolidatedList.filter(c => !globalSearchTerm || Object.values(c).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length / pageSize)} totalItems={consolidatedList.filter(c => !globalSearchTerm || Object.values(c).some(v => v && String(v).toLowerCase().includes(globalSearchTerm.toLowerCase()))).length} pageSize={pageSize} />
          </div>
        )}
      </div>

      {/* Floating + */}
      {puedeEliminar && (
        <button className="inv-add-btn" onClick={openModal} title="Registrar Baja">
          <i className="fa-solid fa-minus"></i>
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay active" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '680px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>
                <i className="fa-solid fa-skull-crossbones" style={{ color: '#dc3545', marginRight: '8px' }}></i>
                Registrar Baja
              </h3>
              <button className="action-btn" onClick={() => setShowModal(false)} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ padding: '25px' }}>
                {/* Tipo de Elemento */}
                <div className="form-group">
                  <label>Tipo de Elemento</label>
                  <SearchableSelect
                    value={tipoElemento}
                    onChange={(val) => { setTipoElemento(val); setSelectedAsset(null); setManualMode(false); setSearchTerm(''); setSearchResults([]); }}
                    options={[
                      { value: 'activo', label: 'Activo Fijo (PC, Monitor, Impresora...)' },
                      { value: 'insumo', label: 'Insumo / Genérico (Mouse, Teclado, RAM...)' }
                    ]}
                    isClearable={false}
                  />
                </div>

                <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />

                {tipoElemento === 'activo' ? (
                  <>
                    {/* Búsqueda */}
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label>Buscar en Inventario</label>
                        <button type="button" onClick={enableManualMode} style={{ fontSize: '12px', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          <i className="fa-solid fa-pen-to-square"></i> Registrar externo
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="text" className="form-control" placeholder="Serial, Nombre o Modelo..." value={searchTerm}
                          onChange={(e) => handleSearch(e.target.value)} />
                        {searching && <i className="fa-solid fa-circle-notch fa-spin" style={{ position: 'absolute', right: '50px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-text)' }}></i>}
                      </div>
                      {searchResults.length > 0 && (
                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '6px', background: 'var(--card-bg)' }}>
                          {searchResults.map((item, i) => (
                            <div key={i} className="search-result-item" onClick={() => selectAsset(item)}
                              style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '13px' }}>
                              <strong style={{ color: 'var(--text-color)' }}>{item.nombre || 'Activo'}</strong>
                              <span style={{ color: 'var(--gray-text)', marginLeft: '8px' }}>{item.nombre_marca || ''} {item.modelo || ''} ({item.serial || ''})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Detalles del activo */}
                    {(selectedAsset || manualMode) && (
                      <div style={{ background: manualMode ? '#fff3cd' : 'var(--input-bg)', padding: '16px', borderRadius: '10px', border: manualMode ? '1px solid #ffc107' : 'none', marginTop: '10px' }}>
                        {manualMode && (
                          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#856404' }}>
                            <strong><i className="fa-solid fa-triangle-exclamation"></i> Modo Manual / Externo</strong><br />
                            Este elemento no se eliminará del inventario actual. Ingrese los datos para el registro histórico.
                          </div>
                        )}
                        <div className="form-group">
                          <label>Categoría / Equipo</label>
                          <input type="text" className="form-control" name="categoria" value={formData.categoria}
                            onChange={(e) => setFormData(p => ({ ...p, categoria: e.target.value }))}
                            placeholder="Ej: Portátil HP" readOnly={!!selectedAsset} />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Marca</label>
                            <input type="text" className="form-control" name="marca" value={formData.marca}
                              onChange={(e) => setFormData(p => ({ ...p, marca: e.target.value }))}
                              readOnly={!!selectedAsset} />
                          </div>
                          <div className="form-group">
                            <label>Modelo</label>
                            <input type="text" className="form-control" name="modelo" value={formData.modelo}
                              onChange={(e) => setFormData(p => ({ ...p, modelo: e.target.value }))}
                              readOnly={!!selectedAsset} />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Serial Fabricante</label>
                            <input type="text" className="form-control" name="serial" value={formData.serial}
                              onChange={(e) => setFormData(p => ({ ...p, serial: e.target.value }))}
                              readOnly={!!selectedAsset} />
                          </div>
                          <div className="form-group">
                            <label>Serial Interno</label>
                            <input type="text" className="form-control" name="serial_interno" value={formData.serial_interno}
                              onChange={(e) => setFormData(p => ({ ...p, serial_interno: e.target.value }))}
                              readOnly={!!selectedAsset} placeholder="(Opcional)" />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Insumo */
                  <>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Categoría</label>
                        <SearchableSelect
                          value={formData.categoria_insumo}
                          onChange={(val) => setFormData(p => ({ ...p, categoria_insumo: val }))}
                          options={CATEGORIAS_INSUMO.map(c => ({ value: c, label: c }))}
                          isClearable={false}
                        />
                      </div>
                      <div className="form-group">
                        <label>Cantidad</label>
                        <input type="number" className="form-control" value={formData.cantidad}
                          onChange={(e) => setFormData(p => ({ ...p, cantidad: e.target.value }))} min="1" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Marca</label>
                      <input type="text" className="form-control" placeholder="Genérico" value={formData.marca_insumo}
                        onChange={(e) => setFormData(p => ({ ...p, marca_insumo: e.target.value }))} />
                    </div>
                  </>
                )}

                {/* Motivo */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Motivo de la Baja <span className="text-danger">*</span></label>
                  <textarea className="form-control" rows="3" placeholder="Ej: Daño irreparable, Obsolescencia..." value={formData.motivo}
                    onChange={(e) => setFormData(p => ({ ...p, motivo: e.target.value }))}
                    required minLength={10} style={{ resize: 'vertical' }}></textarea>
                </div>
              </div>

              <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--input-bg)' }}>
                <button type="button" className="action-btn" onClick={() => setShowModal(false)} style={{ padding: '10px 20px' }}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={saving} style={{ padding: '10px 20px', background: '#dc3545' }}>
                  {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Procesando...</> : <><i className="fa-solid fa-check"></i> Procesar Baja</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .search-result-item:hover {
          background: #f0f7ff !important;
        }
      `}</style>
    </div>
  );
}
