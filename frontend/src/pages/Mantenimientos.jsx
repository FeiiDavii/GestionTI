import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { maintenanceAPI, equipmentAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

export default function Mantenimientos() {
  const { user, permits, hasPermission } = useAuth();
  const canEdit = hasPermission('inv_crear_editar');
  const canMaintenance = hasPermission('tk_mantenimientos');

  // Listing Data State
  const [loading, setLoading] = useState(true);
  const [equipos, setEquipos] = useState([]);
  
  // Lists for Dropdowns
  const [tipos, setTipos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [configuraciones, setConfiguraciones] = useState([]);
  const [areas, setAreas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);

  // Pagination & Search in Table
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Selected Equipment & Detailed Data for Modal
  const [selectedEquipo, setSelectedEquipo] = useState(null);
  const [selectedEquipoDetails, setSelectedEquipoDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('historial'); // historial | preventivo | correctivo | repotenciacion

  // Ficha Técnica Form State
  const [fichaForm, setFichaForm] = useState({
    nombre_equipo: '',
    sistema_operativo: '',
    estado: 'Activo',
    fecha_baja: '',
    teamviewer_id: '',
    teamviewer_version: '',
    id_area: '',
    id_usuario: '',
    justificacion: ''
  });

  // Maintenance Form State
  const [mantenimientoForm, setMantenimientoForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
    razon: '',
    id_configuracion: ''
  });

  // Load Main List and Dropdowns
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [mainRes, listsRes] = await Promise.all([
        maintenanceAPI.list(),
        equipmentAPI.listas()
      ]);
      if (mainRes.data.success) {
        setEquipos(mainRes.data.data.equipos || []);
      }
      if (listsRes.data.success) {
        const l = listsRes.data.data || {};
        setTipos(l.tipos || []);
        setMarcas(l.marcas || []);
        setAreas(l.areas || []);
        setFuncionarios(l.funcionarios || []);
        setConfiguraciones(l.configuraciones || []);
      }
    } catch (err) {
      console.error('Error cargando listados iniciales:', err);
      showToast('Error cargando los listados', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Listen to SSE real-time system updates
  useEffect(() => {
    const handler = () => loadInitialData();
    window.addEventListener('rt:system_update', handler);
    return () => window.removeEventListener('rt:system_update', handler);
  }, [loadInitialData]);

  // Fetch Detailed Hoja de Vida for Modal
  const loadHVDetails = async (id) => {
    setDetailLoading(true);
    try {
      const res = await maintenanceAPI.detail(id);
      if (res.data.success) {
        const d = res.data.data || res.data;
        setSelectedEquipoDetails(d);
        const eq = d.equipo || {};
        setFichaForm({
          nombre_equipo: eq.nombre_equipo || '',
          sistema_operativo: eq.sistema_operativo || '',
          estado: eq.estado || 'Activo',
          fecha_baja: eq.fecha_baja || '',
          teamviewer_id: eq.teamviewer_id || '',
          teamviewer_version: eq.teamviewer_version || '',
          id_area: eq.id_area || '',
          id_usuario: eq.id_usuario || '',
          justificacion: ''
        });
      } else {
        showToast(res.data.message || 'Error cargando detalles', 'error');
      }
    } catch (err) {
      console.error('Error cargando detalles Hoja de Vida:', err);
      showToast('Error de conexión al cargar detalles', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const openHVModal = (equipo) => {
    setSelectedEquipo(equipo);
    setActiveTab('historial');
    setMantenimientoForm({
      fecha: new Date().toISOString().split('T')[0],
      observaciones: '',
      razon: '',
      id_configuracion: ''
    });
    loadHVDetails(equipo.id);
  };

  const closeHVModal = () => {
    setSelectedEquipo(null);
    setSelectedEquipoDetails(null);
  };

  // Submit Changes to Ficha Técnica
  const saveFichaChanges = async (e) => {
    e.preventDefault();
    if (!fichaForm.justificacion.trim() || fichaForm.justificacion.trim().length < 10) {
      showToast('La justificación de cambios debe tener al menos 10 caracteres.', 'warning');
      return;
    }

    try {
      const payload = {
        id_equipo: selectedEquipo.id,
        nombre_equipo: fichaForm.nombre_equipo,
        sistema_operativo: fichaForm.sistema_operativo,
        estado: fichaForm.estado,
        fecha_baja: fichaForm.estado === 'De baja' ? fichaForm.fecha_baja : null,
        teamviewer_id: fichaForm.teamviewer_id,
        teamviewer_version: fichaForm.teamviewer_version,
        id_area: fichaForm.id_area || null,
        id_usuario: fichaForm.id_usuario || null,
        observaciones_cambio: fichaForm.justificacion
      };

      const res = await maintenanceAPI.update(payload);
      if (res.data.success) {
        showToast(res.data.message || 'Ficha técnica actualizada correctamente', 'success');
        await loadHVDetails(selectedEquipo.id);
        await loadInitialData();
      } else {
        showToast(res.data.message || 'Error al actualizar la ficha técnica', 'error');
      }
    } catch (err) {
      console.error('Error actualizando ficha:', err);
      showToast(err.response?.data?.message || 'Error de conexión al actualizar', 'error');
    }
  };

  // Register Maintenance Entry
  const saveMaintenance = async (tipoMaint) => {
    const obs = mantenimientoForm.observaciones.trim();
    const raz = mantenimientoForm.razon.trim();

    if (obs.length < 10) {
      showToast('Las observaciones técnicas deben tener al menos 10 caracteres.', 'warning');
      return;
    }

    if ((tipoMaint === 'Mantenimiento Correctivo' || tipoMaint === 'Repotenciacion') && raz.length < 6) {
      showToast('La razón o falla reportada debe tener al menos 6 caracteres.', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Confirmar registro del mantenimiento?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--primary-color)'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const payload = {
            id_equipo: selectedEquipo.id,
            tipo: tipoMaint,
            fecha: mantenimientoForm.fecha || new Date().toISOString().split('T')[0],
            observaciones: obs,
            razon: raz,
            id_configuracion: tipoMaint === 'Repotenciacion' ? (mantenimientoForm.id_configuracion || null) : null
          };

          const res = await maintenanceAPI.save(payload);
          if (res.data.success) {
            showToast(res.data.message || 'Mantenimiento registrado correctamente', 'success');
            setMantenimientoForm({
              fecha: new Date().toISOString().split('T')[0],
              observaciones: '',
              razon: '',
              id_configuracion: ''
            });
            setActiveTab('historial');
            await loadHVDetails(selectedEquipo.id);
            await loadInitialData();
          } else {
            showToast(res.data.message || 'Error al registrar mantenimiento', 'error');
          }
        } catch (err) {
          console.error('Error registrando mantenimiento:', err);
          showToast(err.response?.data?.message || 'Error de conexión al guardar', 'error');
        }
      }
    });
  };

  // Generate PDF technical report
  const generatePDF = async () => {
    if (!selectedEquipoDetails || !selectedEquipoDetails.equipo) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('p', 'mm', 'a4');
      const e = selectedEquipoDetails.equipo;
      const licencias = selectedEquipoDetails.licencias || [];
      const mantenimientos = selectedEquipoDetails.mantenimientos || [];

      const officeLicense = licencias.find(l => l.nombre_software?.toLowerCase().includes('office'));
      const office = officeLicense
        ? `${officeLicense.nombre_software} ${officeLicense.tipo_edicion || ""}`
        : "No registrado";

      let protecciones = [];
      if (e.prot_cifrado == 1) protecciones.push("Cifrado");
      if (e.prot_antivirus == 1) protecciones.push("Antivirus");
      if (e.prot_firewall == 1) protecciones.push("Firewall");
      let protText = protecciones.length > 0 ? protecciones.join(", ") : "Ninguna";

      doc.setFontSize(16);
      doc.text("HOJA DE VIDA DE EQUIPO", 105, 15, { align: "center" });

      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, 105, 22, { align: "center" });

      const infoData = [
        ["Nombre Equipo", e.nombre_equipo || 'N/A', "Serial", e.serial || 'N/A'],
        ["Marca", e.nombre_marca || e.marca || 'N/A', "Modelo", e.modelo || 'N/A'],
        ["Tipo", e.tipo_equipo || e.tipo || 'N/A', "Configuración", e.ram_rom || "N/A"],
        ["Sistema Operativo", e.sistema_operativo || "N/A", "Office", office],
        ["TeamViewer ID", e.teamviewer_id || "N/A", "TeamViewer Ver.", e.teamviewer_version || "N/A"],
        ["Procesador", e.procesador || "N/A", "Serial Interno", e.serial_interno || "N/A"],
        ["Estado", e.estado || "Activo", "Fecha Baja", e.fecha_baja || "N/A"],
        ["Clasificación", e.nivel_clasificacion || "N/A", "Protecciones", protText],
        ["Fecha Compra", e.fecha_compra || "N/A", "Precio Compra", e.precio_compra ? `$${new Intl.NumberFormat('es-CO').format(e.precio_compra)}` : "N/A"],
        ["Ingresado Por", e.creador_nombre || "Desconocido", "Fecha Creación", e.fecha_creacion || "N/A"],
      ];

      autoTable(doc, {
        startY: 30,
        head: [["Atributo", "Valor", "Atributo", "Valor"]],
        body: infoData,
        theme: "grid",
        headStyles: { fillColor: [78, 115, 223] },
      });

      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text("ASIGNACIÓN ACTUAL", 14, doc.lastAutoTable.finalY + 10);
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        body: [
          ["Área", e.nombre_area || "N/A"],
          ["Responsable", e.responsable || "Sin asignar"],
        ],
        theme: "plain",
      });

      doc.text("HISTORIAL DE MANTENIMIENTOS Y CAMBIOS", 14, doc.lastAutoTable.finalY + 10);

      let histRows = [];
      if (mantenimientos && mantenimientos.length > 0) {
        histRows = mantenimientos.map((h) => {
          let fechaPDF = h.fecha;
          if (h.fecha) {
            const parts = h.fecha.split(" ")[0].split("-");
            if (parts.length === 3)
              fechaPDF = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }

          let details = '';
          if (h.razon) details += `Razón: ${h.razon}\n`;
          if (h.detalles_cambio) details += `Cambios: ${h.detalles_cambio}\n`;
          details += h.observaciones || '';

          return [
            fechaPDF,
            h.tipo_accion || 'N/A',
            h.usuario_nombre || 'Sistema',
            details,
          ];
        });
      } else {
        histRows = [["-", "-", "-", "Sin registros"]];
      }

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [["Fecha", "Acción", "Realizado Por", "Detalles"]],
        body: histRows,
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
        styles: { fontSize: 8, overflow: "linebreak" },
      });

      doc.save(`HojaVida_${e.nombre_equipo || e.id}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Error generando PDF', 'error');
    }
  };

  // Helper date formatter for logs
  const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split(" ")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Filter main list
  const filteredEquipos = equipos.filter(e => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (e.nombre_equipo || '').toLowerCase().includes(query) ||
      (e.serial || '').toLowerCase().includes(query) ||
      (e.responsable || '').toLowerCase().includes(query) ||
      (e.nombre_area || e.area || '').toLowerCase().includes(query) ||
      (e.modelo || '').toLowerCase().includes(query) ||
      (e.nombre_marca || e.marca || '').toLowerCase().includes(query) ||
      (e.tipo_equipo || e.tipo || '').toLowerCase().includes(query)
    );
  });

  // Pagination bounds
  const totalPages = Math.ceil(filteredEquipos.length / pageSize);
  const startIdx = (page - 1) * pageSize;
  const paginatedEquipos = filteredEquipos.slice(startIdx, startIdx + pageSize);

  // Reset pagination on search
  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  // Read-only calculations for selected equipment details
  const currentOfficeText = () => {
    if (!selectedEquipoDetails || !selectedEquipoDetails.licencias) return 'No asignado en Licencias';
    const off = selectedEquipoDetails.licencias.find(l => l.nombre_software?.toLowerCase().includes('office'));
    return off ? `${off.nombre_software} ${off.tipo_edicion || ''}` : 'No asignado en Licencias';
  };

  const currentProteccionesText = () => {
    if (!selectedEquipoDetails || !selectedEquipoDetails.equipo) return 'Ninguna';
    const eq = selectedEquipoDetails.equipo;
    let prot = [];
    if (eq.prot_cifrado == 1) prot.push("Cifrado");
    if (eq.prot_antivirus == 1) prot.push("Antivirus");
    if (eq.prot_firewall == 1) prot.push("Firewall");
    return prot.length > 0 ? prot.join(", ") : "Ninguna";
  };

  // History timeline styles mapping
  const getHistoryItemClass = (tipo) => {
    if (!tipo) return 'history-item data';
    if (tipo.includes('Preventivo')) return 'history-item prev';
    if (tipo.includes('Correctivo')) return 'history-item corr';
    if (tipo.includes('Repotenciacion')) return 'history-item repo';
    return 'history-item data';
  };

  const getHistoryIcon = (tipo) => {
    if (!tipo) return 'fa-pen-to-square';
    if (tipo.includes('Preventivo')) return 'fa-shield-halved';
    if (tipo.includes('Correctivo')) return 'fa-wrench';
    if (tipo.includes('Repotenciacion')) return 'fa-arrow-up-right-dots';
    return 'fa-pen-to-square';
  };

  return (
    <div className="inventory-module">
      <div className="inventory-header">
        <div className="page-title-row">
          <h2><i className="fa-solid fa-clipboard-list"></i> Hoja de Vida y Mantenimientos</h2>
          <div style={{ position: 'relative', width: '280px' }}>
            <i className="fa-solid fa-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--gray-text)', zIndex: 1, fontSize: '14px' }}></i>
            <input className="form-control" type="text" placeholder="Buscar equipo..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', paddingTop: '8px', paddingBottom: '8px' }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-5"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#4a6cf7]"></i></div>
      ) : (
        <div className="table-wrapper">
          <DataTableControls
            pageSize={pageSize}
            setPageSize={setPageSize}
            searchTerm={searchQuery}
            setSearchTerm={setSearchQuery}
            totalItems={equipos.length}
            filteredItemsCount={filteredEquipos.length}
            hideSearch={true}
          />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Marca/Modelo</th>
                  <th>Serial</th>
                  <th>Área</th>
                  <th>Responsable</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEquipos.map(eq => (
                  <tr key={eq.id}>
                    <td>
                      <strong>{eq.nombre_equipo || '-'}</strong>
                      <br />
                      <small className="text-gray-text">{eq.modelo || ''}</small>
                    </td>
                    <td>{eq.nombre_marca || eq.marca || '-'}</td>
                    <td>{eq.serial || '-'}</td>
                    <td>{eq.nombre_area || eq.area || '-'}</td>
                    <td style={{ color: 'var(--primary-color)', fontWeight: 500 }}>
                      {eq.responsable || eq.funcionario || 'Sin asignar'}
                    </td>
                    <td className="text-center">
                      <button className="action-btn" title="Ver Hoja de Vida" onClick={() => openHVModal(eq)}>
                        <i className="fa-solid fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedEquipos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-[var(--gray-text)]">No se encontraron equipos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} setPage={setPage} totalPages={totalPages} totalItems={filteredEquipos.length} pageSize={pageSize} />
        </div>
      )}

      {/* Unified 2-Column Hoja de Vida Modal */}
      {selectedEquipo && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target === e.currentTarget) closeHVModal();
        }}>
          <div className="modal-content" style={{ width: '1200px', maxWidth: '98%', height: '90vh', padding: 0 }}>
            <div className="hv-card">
              
              {/* Modal Header */}
              <div className="hv-header">
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.25rem', fontWeight: 700 }}>
                    <i className="fa-solid fa-server" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                    {selectedEquipoDetails?.equipo?.nombre_equipo || selectedEquipo.nombre_equipo}
                  </h3>
                  <small style={{ color: 'var(--gray-text)', fontWeight: 500 }}>
                    SN: {selectedEquipoDetails?.equipo?.serial || selectedEquipo.serial} 
                    {selectedEquipoDetails?.equipo?.serial_interno && ` | Int: ${selectedEquipoDetails.equipo.serial_interno}`}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-save" onClick={generatePDF} style={{ background: '#e74a3b', padding: '8px 16px', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-file-pdf"></i> PDF
                  </button>
                  <button className="action-btn" onClick={closeHVModal} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-times"></i>
                  </button>
                </div>
              </div>

              {detailLoading ? (
                <div className="text-center p-5 flex-grow flex items-center justify-center">
                  <i className="fa-solid fa-circle-notch fa-spin text-4xl text-[#4a6cf7]"></i>
                </div>
              ) : (
                <div className="hv-body">
                  
                  {/* Left Column: Ficha Técnica */}
                  <div className="hv-info-col">
                    <h4 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: 600, fontSize: '1rem' }}>
                      Ficha Técnica
                    </h4>

                    <form onSubmit={saveFichaChanges} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Nombre de Red</label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={!canEdit}
                          value={fichaForm.nombre_equipo}
                          onChange={(e) => setFichaForm(prev => ({ ...prev, nombre_equipo: e.target.value }))}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Sistema Operativo</label>
                          <SearchableSelect
                            value={fichaForm.sistema_operativo}
                            onChange={(val) => setFichaForm(prev => ({ ...prev, sistema_operativo: val }))}
                            options={[
                              { value: '', label: 'Seleccione...' },
                              { value: 'Windows 7', label: 'Windows 7' },
                              { value: 'Windows 8', label: 'Windows 8' },
                              { value: 'Windows 10', label: 'Windows 10' },
                              { value: 'Windows 11', label: 'Windows 11' },
                              { value: 'MAC OS', label: 'MAC OS' },
                              { value: 'LINUX', label: 'LINUX' }
                            ]}
                            isDisabled={!canEdit}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Office Instalado</label>
                          <input
                            type="text"
                            className="form-control"
                            readOnly
                            style={{ background: 'var(--input-bg)', color: 'var(--gray-text)' }}
                            value={currentOfficeText()}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Estado del Activo</label>
                          <SearchableSelect
                            value={fichaForm.estado}
                            onChange={(val) => setFichaForm(prev => ({ ...prev, estado: val }))}
                            options={[
                              { value: 'Activo', label: 'Activo' },
                              { value: 'En mantenimiento', label: 'En mantenimiento' },
                              { value: 'De baja', label: 'De baja' }
                            ]}
                            isDisabled={!canEdit}
                          />
                        </div>
                        {fichaForm.estado === 'De baja' && (
                          <div className="form-group" style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600 }}>Fecha de Baja</label>
                            <input
                              type="date"
                              className="form-control"
                              readOnly={!canEdit}
                              value={fichaForm.fecha_baja ? fichaForm.fecha_baja.split(' ')[0] : ''}
                              onChange={(e) => setFichaForm(prev => ({ ...prev, fecha_baja: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>TeamViewer ID</label>
                          <input
                            type="text"
                            className="form-control"
                            readOnly={!canEdit}
                            value={fichaForm.teamviewer_id}
                            onChange={(e) => setFichaForm(prev => ({ ...prev, teamviewer_id: e.target.value }))}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>TeamViewer Versión</label>
                          <input
                            type="text"
                            className="form-control"
                            readOnly={!canEdit}
                            value={fichaForm.teamviewer_version}
                            onChange={(e) => setFichaForm(prev => ({ ...prev, teamviewer_version: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Área Asignada</label>
                        <SearchableSelect
                          value={fichaForm.id_area}
                          onChange={(val) => setFichaForm(prev => ({ ...prev, id_area: val }))}
                          options={areas.map(a => ({ value: a.id, label: a.nombre_area }))}
                          isDisabled={!canEdit}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Funcionario Responsable</label>
                        <SearchableSelect
                          value={fichaForm.id_usuario}
                          onChange={(val) => setFichaForm(prev => ({ ...prev, id_usuario: val }))}
                          options={funcionarios.map(f => ({ value: f.id, label: `${f.nombre} ${f.apellido}` }))}
                          isDisabled={!canEdit}
                        />
                      </div>

                      {/* Static Info: Hardware */}
                      <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '8px', marginTop: '6px' }}>
                        <div className="info-group">
                          <label>Marca / Modelo</label>
                          <div>
                            {selectedEquipoDetails?.equipo?.nombre_marca || selectedEquipoDetails?.equipo?.marca || 'N/A'}{' '}
                            {selectedEquipoDetails?.equipo?.modelo || 'N/A'}
                          </div>
                        </div>
                        <div className="info-group">
                          <label>Hardware (RAM/ROM)</label>
                          <div>{selectedEquipoDetails?.equipo?.ram_rom || selectedEquipoDetails?.equipo?.ram || 'N/A'}</div>
                        </div>
                        <div className="info-group" style={{ marginBottom: 0 }}>
                          <label>Procesador</label>
                          <div>{selectedEquipoDetails?.equipo?.procesador || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Static Info: Audit & Acquisition */}
                      <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '8px', marginTop: '6px' }}>
                        <h5 style={{ margin: '0 0 10px', color: 'var(--primary-color)', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Datos de Seguridad, Auditoría y Adquisición
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div className="info-group">
                            <label>Clasificación</label>
                            <div>{selectedEquipoDetails?.equipo?.nivel_clasificacion || 'N/A'}</div>
                          </div>
                          <div className="info-group">
                            <label>Protecciones</label>
                            <div>{currentProteccionesText()}</div>
                          </div>
                          <div className="info-group">
                            <label>Ingresado por</label>
                            <div>{selectedEquipoDetails?.equipo?.creador_nombre || 'Sistema / Desconocido'}</div>
                          </div>
                          <div className="info-group">
                            <label>Fecha Creación</label>
                            <div>{selectedEquipoDetails?.equipo?.fecha_creacion || 'N/A'}</div>
                          </div>
                          <div className="info-group">
                            <label>Fecha Compra</label>
                            <div>{selectedEquipoDetails?.equipo?.fecha_compra || 'N/A'}</div>
                          </div>
                          <div className="info-group">
                            <label>Precio Compra</label>
                            <div>
                              {selectedEquipoDetails?.equipo?.precio_compra
                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(selectedEquipoDetails.equipo.precio_compra)
                                : 'N/A'}
                            </div>
                          </div>
                          <div className="info-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                            <label>Última Actualización</label>
                            <div style={{ color: 'var(--info-color)', fontWeight: 'bold' }}>
                              {selectedEquipoDetails?.equipo?.fecha_actualizacion || 'Sin actualizaciones recientes'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {canEdit && (
                        <>
                          <div className="form-group" style={{ marginTop: '10px' }}>
                            <label style={{ color: '#e74a3b', fontWeight: 600 }}>Justificación de Cambios (Obligatorio)</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              placeholder="Describa por qué modifica los datos (mínimo 10 caracteres)..."
                              required
                              value={fichaForm.justificacion}
                              onChange={(e) => setFichaForm(prev => ({ ...prev, justificacion: e.target.value }))}
                            />
                          </div>

                          <button type="submit" className="btn-save" style={{ width: '100%', marginTop: '6px', justifyContent: 'center' }}>
                            <i className="fa-solid fa-floppy-disk"></i> Guardar Cambios Ficha
                          </button>
                        </>
                      )}
                    </form>
                  </div>

                  {/* Right Column: Actions / History */}
                  <div className="hv-actions-col">
                    
                    {/* Tab Navigation */}
                    <div className="action-tabs">
                      <div className={`act-tab ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
                        Ver Historial
                      </div>
                      {canEdit && (
                        <>
                          <div className={`act-tab ${activeTab === 'preventivo' ? 'active' : ''}`} onClick={() => setActiveTab('preventivo')}>
                            + Preventivo
                          </div>
                          <div className={`act-tab ${activeTab === 'correctivo' ? 'active' : ''}`} onClick={() => setActiveTab('correctivo')}>
                            + Correctivo
                          </div>
                          <div className={`act-tab ${activeTab === 'repotenciacion' ? 'active' : ''}`} onClick={() => setActiveTab('repotenciacion')}>
                            + Repotenciación
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tab Panels */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                      
                      {activeTab === 'preventivo' && (
                        <div className="form-dynamic">
                          <h5 style={{ margin: '0 0 12px 0', color: 'var(--success-color)', fontWeight: 600 }}>
                            Nuevo Mantenimiento Preventivo
                          </h5>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label>Fecha</label>
                              <input
                                type="date"
                                className="form-control"
                                required
                                value={mantenimientoForm.fecha}
                                onChange={(e) => setMantenimientoForm(prev => ({ ...prev, fecha: e.target.value }))}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label>Técnico</label>
                              <input
                                type="text"
                                className="form-control"
                                readOnly
                                value={user?.nombre || ''}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Observaciones de Limpieza / Optimización</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Detalle la limpieza física, desfragmentación, eliminación de archivos temporales (mínimo 10 caracteres)..."
                              required
                              value={mantenimientoForm.observaciones}
                              onChange={(e) => setMantenimientoForm(prev => ({ ...prev, observaciones: e.target.value }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-save"
                            style={{ background: 'var(--success-color)', borderColor: 'var(--success-color)', boxShadow: '0 4px 12px rgba(40,167,69,0.3)' }}
                            onClick={() => saveMaintenance('Mantenimiento Preventivo')}
                          >
                            Registrar
                          </button>
                        </div>
                      )}

                      {activeTab === 'correctivo' && (
                        <div className="form-dynamic">
                          <h5 style={{ margin: '0 0 12px 0', color: 'var(--error-color)', fontWeight: 600 }}>
                            Nuevo Mantenimiento Correctivo
                          </h5>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label>Fecha</label>
                              <input
                                type="date"
                                className="form-control"
                                required
                                value={mantenimientoForm.fecha}
                                onChange={(e) => setMantenimientoForm(prev => ({ ...prev, fecha: e.target.value }))}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label>Técnico</label>
                              <input
                                type="text"
                                className="form-control"
                                readOnly
                                value={user?.nombre || ''}
                              />
                            </div>
                          </div>
                          <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label>Razón o Falla Reportada</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Ej: Pantalla azul constante / No enciende (mínimo 6 caracteres)..."
                              required
                              value={mantenimientoForm.razon}
                              onChange={(e) => setMantenimientoForm(prev => ({ ...prev, razon: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label>Solución Técnica Aplicada</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Detalle el procedimiento técnico y componentes reparados (mínimo 10 caracteres)..."
                              required
                              value={mantenimientoForm.observaciones}
                              onChange={(e) => setMantenimientoForm(prev => ({ ...prev, observaciones: e.target.value }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-save"
                            style={{ background: 'var(--error-color)', borderColor: 'var(--error-color)', boxShadow: '0 4px 12px rgba(220,53,69,0.3)' }}
                            onClick={() => saveMaintenance('Mantenimiento Correctivo')}
                          >
                            Registrar
                          </button>
                        </div>
                      )}

                      {activeTab === 'repotenciacion' && (
                        <div className="form-dynamic">
                          <h5 style={{ margin: '0 0 12px 0', color: 'var(--warning-color)', fontWeight: 600 }}>
                            Nueva Repotenciación
                          </h5>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label>Fecha</label>
                              <input
                                type="date"
                                className="form-control"
                                required
                                value={mantenimientoForm.fecha}
                                onChange={(e) => setMantenimientoForm(prev => ({ ...prev, fecha: e.target.value }))}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label>Técnico</label>
                              <input
                                type="text"
                                className="form-control"
                                readOnly
                                value={user?.nombre || ''}
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label>Actualizar Configuración Hardware</label>
                            <SearchableSelect
                              value={mantenimientoForm.id_configuracion}
                              onChange={(val) => setMantenimientoForm(prev => ({ ...prev, id_configuracion: val }))}
                              options={configuraciones.map(c => ({ value: c.id, label: c.ram_rom }))}
                              placeholder="-- Mantener Configuración Actual --"
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label>Justificación / Solicitud</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Ej: Solicitud de ampliación de velocidad (mínimo 6 caracteres)..."
                              required
                              value={mantenimientoForm.razon}
                              onChange={(e) => setMantenimientoForm(prev => ({ ...prev, razon: e.target.value }))}
                            />
                          </div>

                          <div className="form-group">
                            <label>Hardware Instalado / Cambios Realizados</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              placeholder="Detalle los nuevos componentes instalados (RAM, SSD, etc. - mínimo 10 caracteres)..."
                              required
                              value={mantenimientoForm.observaciones}
                              onChange={(e) => setMantenimientoForm(prev => ({ ...prev, observaciones: e.target.value }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-save"
                            style={{ background: 'var(--warning-color)', borderColor: 'var(--warning-color)', color: '#212529', boxShadow: '0 4px 12px rgba(255,193,7,0.3)' }}
                            onClick={() => saveMaintenance('Repotenciacion')}
                          >
                            Registrar
                          </button>
                        </div>
                      )}

                      {/* History Log Timeline Panel */}
                      {activeTab === 'historial' && (
                        <div style={{ flexGrow: 1, paddingRight: '5px' }}>
                          {!selectedEquipoDetails?.mantenimientos || selectedEquipoDetails.mantenimientos.length === 0 ? (
                            <div className="text-center text-muted" style={{ padding: '30px var(--card-bg)' }}>
                              Sin historial registrado.
                            </div>
                          ) : (
                            selectedEquipoDetails.mantenimientos.map((h, index) => (
                              <div className={getHistoryItemClass(h.tipo_accion)} key={h.id || index}>
                                <span className="h-date">{formatHistoryDate(h.fecha)}</span>
                                <div className="h-title">
                                  <i className={`fa-solid ${getHistoryIcon(h.tipo_accion)}`}></i>
                                  {h.tipo_accion || 'Mantenimiento / Registro'}
                                </div>
                                <div className="h-desc">
                                  {h.razon && (
                                    <>
                                      <strong>Razón:</strong> {h.razon}
                                      <br />
                                    </>
                                  )}
                                  {h.detalles_cambio && (
                                    <small style={{ display: 'block', marginBottom: '5px', color: 'var(--primary-color)', fontWeight: 600 }}>
                                      {h.detalles_cambio}
                                    </small>
                                  )}
                                  {h.observaciones}
                                </div>
                                <div className="h-user">
                                  <i className="fa-solid fa-user-circle"></i>
                                  Reg. por: {h.usuario_nombre || h.username || 'Sistema'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
