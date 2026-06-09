import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportAPI } from '../api/client';
import { showToast } from '../core/toast';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

/* ─────────────────────────── Constants ─────────────────────────── */
const REPORT_TYPES = [
  { id: 'equipos',   name: 'Equipos',          icon: 'fa-computer',          color: '#4a6cf7' },
  { id: 'repuestos', name: 'Repuestos',         icon: 'fa-microchip',         color: '#1cc88a' },
  { id: 'licencias', name: 'Licencias',         icon: 'fa-key',               color: '#f6c23e' },
  { id: 'tickets',   name: 'Tickets',           icon: 'fa-headset',           color: '#36b9cc' },
  { id: 'bajas',     name: 'Bajas',             icon: 'fa-skull-crossbones',  color: '#e74a3b' },
  { id: 'logs',      name: 'Auditoría (Logs)',  icon: 'fa-clock-rotate-left', color: '#5a5c69' },
];

const FIELD_MAP = {
  equipos:   [
    { id: 'nombre_equipo', label: 'Equipo' },
    { id: 'serial',        label: 'Serial' },
    { id: 'serial_interno',label: 'Serial Interno' },
    { id: 'tipo',          label: 'Tipo' },
    { id: 'marca',         label: 'Marca' },
    { id: 'area',          label: 'Área' },
    { id: 'procesador',    label: 'Procesador' },
    { id: 'configuracion', label: 'Configuración' },
    { id: 'so',            label: 'S.O.' },
    { id: 'estado',        label: 'Estado' },
    { id: 'clasificacion', label: 'Clasificación' },
    { id: 'responsable',   label: 'Responsable' },
    { id: 'protecciones',  label: 'Protecciones' },
    { id: 'fecha_compra',  label: 'F. Compra' },
    { id: 'fecha_baja',    label: 'F. Baja' },
    { id: 'precio_compra', label: 'Precio' },
  ],
  repuestos: [
    { id: 'nombre',      label: 'Artículo' },
    { id: 'modelo',      label: 'Modelo' },
    { id: 'marca',       label: 'Marca' },
    { id: 'caracteristicas', label: 'Características' },
    { id: 'total',       label: 'Stock Total' },
    { id: 'asignado',    label: 'Asignados' },
    { id: 'disponible',  label: 'Disponibles' },
  ],
  licencias: [
    { id: 'software',      label: 'Software' },
    { id: 'tipo_edicion',  label: 'Edición' },
    { id: 'serial',        label: 'Serial' },
    { id: 'area',          label: 'Área' },
    { id: 'equipo_asignado', label: 'Equipo' },
    { id: 'fecha_creacion',  label: 'F. Creación' },
  ],
  tickets: [
    { id: 'id',            label: 'ID' },
    { id: 'titulo',        label: 'Asunto' },
    { id: 'solicitante',   label: 'Solicitante' },
    { id: 'area',          label: 'Área' },
    { id: 'prioridad',     label: 'Prioridad' },
    { id: 'estado',        label: 'Estado' },
    { id: 'asignado_a',    label: 'Técnico' },
    { id: 'calificacion',  label: 'Calificación' },
    { id: 'fecha_creacion',label: 'F. Creación' },
    { id: 'fecha_cierre',  label: 'F. Cierre' },
  ],
  bajas: [
    { id: 'id',          label: 'ID' },
    { id: 'fecha',       label: 'Fecha' },
    { id: 'tipo_activo', label: 'Tipo' },
    { id: 'categoria',   label: 'Categoría' },
    { id: 'marca',       label: 'Marca' },
    { id: 'modelo',      label: 'Modelo' },
    { id: 'serial',      label: 'Serial' },
    { id: 'motivo',      label: 'Motivo' },
    { id: 'cantidad',    label: 'Cantidad' },
    { id: 'responsable', label: 'Responsable' },
  ],
  logs: [
    { id: 'id',      label: 'ID' },
    { id: 'fecha',   label: 'Fecha/Hora' },
    { id: 'usuario', label: 'Usuario' },
    { id: 'tabla',   label: 'Módulo' },
    { id: 'detalle', label: 'Acción' },
  ],
};

/* ─────────────────── Badge helpers ─────────────────── */
const estadoEquipoColor = { activo:'#1cc88a', mantenimiento:'#f6c23e', baja:'#e74a3b', reserva:'#36b9cc', 'de baja':'#e74a3b' };
const estadoTicketColor = { Abierto:'#4a6cf7', 'En Proceso':'#f6c23e', Resuelto:'#1cc88a', Cerrado:'#5a5c69' };
const prioridadColor    = { Baja:'#1cc88a', Media:'#f6c23e', Alta:'#e67e22', 'Crítica':'#e74a3b', critica:'#e74a3b', alta:'#e67e22', media:'#f6c23e', baja:'#1cc88a' };
const estadoLicColor    = { activa:'#1cc88a', vencida:'#e74a3b', por_vencer:'#f6c23e' };
const tipoActivoColor   = { 'Activo Fijo':'#4a6cf7', 'Insumo/Generico':'#f6c23e' };

function Badge({ value, colorMap }) {
  const color = colorMap?.[value?.toLowerCase?.()] || colorMap?.[value] || '#888';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: '20px', fontSize: '11px',
      fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`,
      textTransform: 'capitalize', whiteSpace: 'nowrap'
    }}>
      {value || '-'}
    </span>
  );
}

function StarRating({ value }) {
  const n = parseInt(value) || 0;
  if (!n) return <span style={{ color: '#bbb', fontSize: '11px' }}>Sin calificar</span>;
  return (
    <span style={{ color: '#f6c23e', fontSize: '13px', letterSpacing: 1 }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
      <span style={{ color: '#888', fontSize: '10px', marginLeft: 4 }}>({n}/5)</span>
    </span>
  );
}

function formatCurrency(val) {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
  } catch (e) {
    return val;
  }
}

function renderCell(fieldId, value, tipo) {
  if (value === null || value === undefined || value === '') return <span style={{ color: '#bbb' }}>—</span>;
  if (tipo === 'equipos'   && fieldId === 'estado')      return <Badge value={value} colorMap={estadoEquipoColor} />;
  if (tipo === 'tickets'   && fieldId === 'estado')      return <Badge value={value} colorMap={estadoTicketColor} />;
  if (tipo === 'tickets'   && fieldId === 'prioridad')   return <Badge value={value} colorMap={prioridadColor} />;
  if (tipo === 'tickets'   && fieldId === 'calificacion')return <StarRating value={value} />;
  if (tipo === 'bajas'     && fieldId === 'tipo_activo') return <Badge value={value} colorMap={tipoActivoColor} />;
  if (tipo === 'equipos'   && fieldId === 'precio_compra' && value) return <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatCurrency(value)}</span>;
  if (tipo === 'equipos'   && fieldId === 'protecciones' && value) {
    const icons = value.split(', ').map(p => p.trim());
    return <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{icons.map((ic, i) => (
      <span key={i} style={{ fontSize: '10px', background: '#e8f0fe', color: '#4a6cf7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{ic}</span>
    ))}</span>;
  }
  return <span style={{ fontSize: '12px' }}>{String(value)}</span>;
}

/* ══════════════════════════════ MAIN COMPONENT ══════════════════════════════ */
export default function Reportes() {
  const { user } = useAuth();

  // Report state
  const [selectedType, setSelectedType]   = useState('equipos');
  const [loading, setLoading]             = useState(false);
  const [data, setData]                   = useState([]);
  const [filters, setFilters]             = useState({});
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [totalRows, setTotalRows]         = useState(0);
  const [selectedFields, setSelectedFields] = useState(FIELD_MAP['equipos'].map(f => f.id));
  const [searchTerm, setSearchTerm]       = useState('');
  const [hasGenerated, setHasGenerated]   = useState(false);
  const [pageSize, setPageSize]           = useState(50);

  // Dynamic filter options
  const [listas, setListas] = useState({ areas: [], marcas: [], tecnicos: [], usuarios: [] });

  // Load filter options on mount
  useEffect(() => {
    reportAPI.listas().then(r => {
      if (r.data?.success) setListas(r.data.data);
    }).catch(() => {});
  }, []);

  const fields = FIELD_MAP[selectedType] || [];

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setData([]);
    setFilters({});
    setPage(1);
    setSearchTerm('');
    setSelectedFields(FIELD_MAP[type]?.map(f => f.id) || []);
    setHasGenerated(false);
    setTotalRows(0);
    setTotalPages(1);
  };

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));
  const clearFilters = () => { setFilters({}); setSearchTerm(''); };

  /* ── Load report ── */
  const loadReport = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await reportAPI.generate({
        tipo: selectedType,
        filtros: { ...filters, search: searchTerm || undefined },
        page: p,
        limit: pageSize,
      });
      if (res.data?.success) {
        const result = res.data.data || {};
        setData(result.data || []);
        setTotalRows(result.total || 0);
        setTotalPages(result.totalPages || 1);
        setPage(p);
        setHasGenerated(true);
        if (p === 1 && (result.data || []).length === 0) showToast('No hay datos para los filtros aplicados', 'info');
      } else {
        showToast('No hay datos disponibles', 'warning');
        setData([]);
      }
    } catch {
      showToast('Error al generar el reporte', 'error');
    }
    setLoading(false);
  }, [selectedType, filters, searchTerm]);

  /* ── Toggle field ── */
  const toggleField = (id) => setSelectedFields(prev => {
    if (prev.includes(id)) { if (prev.length === 1) return prev; return prev.filter(f => f !== id); }
    // Mantener orden original
    return fields.map(f => f.id).filter(fid => [...prev, id].includes(fid));
  });

  /* ── Export CSV ── */
  const exportCSV = () => {
    if (!data.length) { showToast('No hay datos para exportar', 'info'); return; }
    const visibleFields = fields.filter(f => selectedFields.includes(f.id));
    const header = visibleFields.map(f => `"${f.label}"`).join(',');
    const rows = data.map(item =>
      visibleFields.map(f => {
        const v = item[f.id];
        return `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_${selectedType}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV exportado', 'success');
  };

  /* ── Export PDF ── */
  const exportPDF = async () => {
    if (!data.length) { showToast('No hay datos para exportar', 'info'); return; }
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('l', 'mm', 'a4');
      const reportName = REPORT_TYPES.find(r => r.id === selectedType)?.name || selectedType;
      const visibleFields = fields.filter(f => selectedFields.includes(f.id));

      // Header
      doc.setFillColor(74, 108, 247);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(`Reporte de ${reportName}`, 14, 14);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(
        `Generado: ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}   |   Total: ${totalRows} registros`,
        14, 20
      );

      autoTable(doc, {
        startY: 28,
        head: [visibleFields.map(f => f.label)],
        body: data.map(item => visibleFields.map(f => String(item[f.id] ?? ''))),
        theme: 'grid',
        headStyles: { fillColor: [74, 108, 247], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 2, overflow: 'linebreak' },
        margin: { left: 10, right: 10 },
      });

      doc.save(`reporte_${selectedType}_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('PDF generado', 'success');
    } catch (err) {
      console.error('Error PDF:', err);
      showToast('Error generando PDF', 'error');
    }
  };

  /* ── Sidebar filter panels ── */
  const renderSidebarFilters = () => {
    const inputStyle = {
      width: '100%', padding: '7px 10px', borderRadius: '8px', fontSize: '12px',
      border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)',
      outline: 'none', transition: 'border-color 0.2s'
    };
    const labelStyle = { fontSize: '11px', fontWeight: 600, color: 'var(--gray-text)', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' };
    const g = (label, children) => (
      <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>{label}</label>
        {children}
      </div>
    );

    const selectEl = (key, options, placeholder = 'Todos') => (
      <select style={inputStyle} value={filters[key] || ''} onChange={e => setFilter(key, e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );

    const inputEl = (key, type = 'text', placeholder = '') => (
      <input style={inputStyle} type={type} placeholder={placeholder}
        value={filters[key] || ''} onChange={e => setFilter(key, e.target.value)}
        onKeyDown={e => e.key === 'Enter' && loadReport(1)} />
    );

    const areaSelect = selectEl('id_area', listas.areas.map(a => ({ value: a.id, label: a.nombre_area })), 'Todas las áreas');
    const marcaSelect = selectEl('id_marca', listas.marcas.map(m => ({ value: m.id, label: m.nombre_marca })), 'Todas las marcas');

    switch (selectedType) {
      case 'equipos': return <>
        {g('Estado', selectEl('estado', [
          { value: 'activo', label: 'Activo' },
          { value: 'mantenimiento', label: 'En Mantenimiento' },
          { value: 'baja', label: 'Dado de Baja' },
          { value: 'reserva', label: 'En Reserva' },
        ]))}
        {g('Clasificación', selectEl('clasificacion', [
          { value: 'Computador', label: 'Computadores' },
          { value: 'Impresora/Escaner', label: 'Impresoras / Escáneres' },
          { value: 'Monitor', label: 'Monitores' },
          { value: 'Teléfono', label: 'Teléfonos IP' },
          { value: 'Otro', label: 'Otros Dispositivos' },
        ]))}
        {g('Área', areaSelect)}
        {g('Marca', marcaSelect)}
      </>;

      case 'repuestos': return <>
        {g('Marca', marcaSelect)}
        {g('Stock máx. (alerta)', inputEl('stock_min', 'number', 'Ej: 5'))}
        {g('Ubicación', inputEl('ubicacion', 'text', 'Filtrar por ubicación...'))}
      </>;

      case 'licencias': return <>
        {g('Estado', selectEl('estado', [
          { value: 'activa', label: 'Activa' },
          { value: 'vencida', label: 'Vencida' },
          { value: 'por_vencer', label: 'Por Vencer' },
        ]))}
        {g('Área', areaSelect)}
        {g('Software', inputEl('software', 'text', 'Nombre del software...'))}
      </>;

      case 'tickets': return <>
        {g('Estado', selectEl('estado', [
          { value: 'Abierto', label: 'Abierto' },
          { value: 'En Proceso', label: 'En Proceso' },
          { value: 'Resuelto', label: 'Resuelto' },
          { value: 'Cerrado', label: 'Cerrado' },
        ]))}
        {g('Prioridad', selectEl('prioridad', [
          { value: 'Baja', label: 'Baja' },
          { value: 'Media', label: 'Media' },
          { value: 'Alta', label: 'Alta' },
          { value: 'Crítica', label: 'Crítica' },
        ]))}
        {g('Calificación', selectEl('calificacion', [
          { value: 'unrated', label: 'Sin Calificar' },
          { value: '1', label: '★ 1 Estrella (Deficiente)' },
          { value: '2', label: '★★ 2 Estrellas' },
          { value: '3', label: '★★★ 3 Estrellas (Aceptable)' },
          { value: '4', label: '★★★★ 4 Estrellas' },
          { value: '5', label: '★★★★★ 5 Estrellas (Excelente)' },
        ]))}
        {g('Técnico', selectEl('id_tecnico', listas.tecnicos.map(t => ({ value: t.id, label: t.nombre_completo })), 'Cualquier técnico'))}
        {g('Área', areaSelect)}
        {g('Desde', inputEl('desde', 'date'))}
        {g('Hasta', inputEl('hasta', 'date'))}
      </>;

      case 'bajas': return <>
        {g('Origen', selectEl('tipo_activo', [
          { value: 'Activo Fijo', label: 'Activo Fijo (Inventario Principal)' },
          { value: 'Insumo/Generico', label: 'Repuestos / Insumos' },
        ]))}  
        {g('Desde', inputEl('desde', 'date'))}
        {g('Hasta', inputEl('hasta', 'date'))}
      </>;

      case 'logs': return <>
        {g('Usuario', selectEl('id_usuario', listas.usuarios.map(u => ({ value: u.id, label: u.nombre_completo })), 'Todos los usuarios'))}
        {g('Tabla afectada', inputEl('tabla', 'text', 'Ej: equipos_de_computo...'))}
        {g('Palabra clave (detalle)', inputEl('accion', 'text', 'Buscar en descripción...'))}
        {g('Desde', inputEl('desde', 'date'))}
        {g('Hasta', inputEl('hasta', 'date'))}
      </>;

      default: return null;
    }
  };

  /* ── Pagination ── */
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const maxButtons = 7;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end   = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button className="action-btn" disabled={page <= 1} onClick={() => loadReport(page - 1)}
          style={{ opacity: page <= 1 ? 0.4 : 1, fontSize: '12px', padding: '5px 10px' }}>
          <i className="fa-solid fa-chevron-left" /> Anterior
        </button>
        {start > 1 && <><button style={btnPageStyle(false)} onClick={() => loadReport(1)}>1</button><span style={{ color: '#bbb' }}>…</span></>}
        {pages.map(p => (
          <button key={p} style={btnPageStyle(p === page)} onClick={() => loadReport(p)}>{p}</button>
        ))}
        {end < totalPages && <><span style={{ color: '#bbb' }}>…</span><button style={btnPageStyle(false)} onClick={() => loadReport(totalPages)}>{totalPages}</button></>}
        <button className="action-btn" disabled={page >= totalPages} onClick={() => loadReport(page + 1)}
          style={{ opacity: page >= totalPages ? 0.4 : 1, fontSize: '12px', padding: '5px 10px' }}>
          Siguiente <i className="fa-solid fa-chevron-right" />
        </button>
        <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
          {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalRows)} de {totalRows}
        </span>
      </div>
    );
  };

  const btnPageStyle = (active) => ({
    minWidth: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    background: active ? 'var(--primary-color)' : '#f1f5f9',
    color: active ? '#fff' : '#555', fontWeight: active ? 700 : 400,
    fontSize: '12px', transition: 'all 0.2s', padding: '0 8px'
  });

  /* ── Local filter + pagination ── */
  const localFilteredData = useMemo(() => {
    if (!searchTerm.trim() || !data.length) return data;
    const q = searchTerm.toLowerCase();
    return data.filter(item =>
      fields.some(f => selectedFields.includes(f.id) && String(item[f.id] ?? '').toLowerCase().includes(q))
    );
  }, [data, searchTerm, fields, selectedFields]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return localFilteredData.slice(start, start + pageSize);
  }, [localFilteredData, page, pageSize]);

  useEffect(() => { setPage(1); }, [localFilteredData.length, pageSize]);

  const localTotalPages = Math.ceil(localFilteredData.length / pageSize);

  const activeType = REPORT_TYPES.find(r => r.id === selectedType);

  /* ══════════════════════ RENDER ══════════════════════ */
  return (
    <div className="inventory-module">
      {/* ── Header ── */}
      <div className="inventory-header">
        <div className="page-title-row">
          <h2><i className="fa-solid fa-file-invoice" /> Reportes y Logs</h2>
        </div>
      </div>

      {/* ── Type tabs ── */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', boxShadow: '0 2px 10px var(--shadow-color)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {REPORT_TYPES.map(rt => {
            const active = selectedType === rt.id;
            return (
              <button key={rt.id} onClick={() => handleTypeChange(rt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px',
                  borderRadius: '10px', cursor: 'pointer', border: 'none', outline: 'none',
                  background: active ? rt.color : 'var(--input-bg)',
                  color: active ? '#fff' : 'var(--text-color)',
                  fontWeight: active ? 700 : 400, fontSize: '13px',
                  boxShadow: active ? `0 4px 12px ${rt.color}55` : 'none',
                  transform: active ? 'translateY(-1px)' : 'none',
                  transition: 'all 0.2s',
                }}>
                <i className={`fa-solid ${rt.icon}`} />
                {rt.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          background: 'var(--card-bg)', borderRadius: '14px', padding: '20px',
          boxShadow: '0 2px 10px var(--shadow-color)', border: '1px solid var(--border-color)',
          position: 'sticky', top: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <i className="fa-solid fa-filter" style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)' }}>Filtros</h4>
          </div>

          {/* Global search */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-text)', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Búsqueda Global
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: '12px' }} />
              <input
                style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', outline: 'none' }}
                type="text" placeholder="Buscar palabras clave..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadReport(1)}
              />
            </div>
          </div>

          {/* Dynamic filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {renderSidebarFilters()}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn-save" style={{ width: '100%', justifyContent: 'center', gap: '6px', display: 'flex', alignItems: 'center' }}
              onClick={() => loadReport(1)} disabled={loading}>
              <i className={`fa-solid ${loading ? 'fa-circle-notch fa-spin' : 'fa-arrows-rotate'}`} />
              {loading ? 'Generando...' : 'Generar Vista Previa'}
            </button>
            <button className="action-btn" style={{ width: '100%', justifyContent: 'center', gap: '6px', display: 'flex', alignItems: 'center', fontSize: '12px' }}
              onClick={clearFilters}>
              <i className="fa-solid fa-eraser" /> Limpiar Filtros
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Column selector */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 10px var(--shadow-color)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-color)', fontWeight: 700 }}>
                  <i className="fa-solid fa-table-columns" style={{ color: 'var(--primary-color)' }} /> Columnas a Exportar
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--gray-text)' }}>
                  Selecciona los campos a incluir en la tabla y en las exportaciones.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="action-btn" style={{ fontSize: '11px', padding: '3px 10px' }}
                  onClick={() => setSelectedFields(fields.map(f => f.id))}>
                  Todas
                </button>
                <button className="action-btn" style={{ fontSize: '11px', padding: '3px 10px' }}
                  onClick={() => setSelectedFields([fields[0]?.id].filter(Boolean))}>
                  Ninguna
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {fields.map(f => {
                const active = selectedFields.includes(f.id);
                return (
                  <label key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px',
                    padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                    background: active ? 'rgba(74,108,247,0.1)' : 'var(--input-bg)',
                    border: `1px solid ${active ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    color: active ? 'var(--primary-color)' : 'var(--gray-text)',
                    fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                    userSelect: 'none',
                  }}>
                    <input type="checkbox" checked={active} onChange={() => toggleField(f.id)} style={{ display: 'none' }} />
                    {active && <i className="fa-solid fa-check" style={{ fontSize: '10px' }} />}
                    {f.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Results + Export */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 10px var(--shadow-color)', border: '1px solid var(--border-color)' }}>

            {/* Export toolbar */}
            {hasGenerated && !loading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: activeType?.color + '22', color: activeType?.color,
                    border: `1px solid ${activeType?.color}44`, borderRadius: '20px',
                    padding: '3px 12px', fontSize: '12px', fontWeight: 600,
                  }}>
                    <i className={`fa-solid ${activeType?.icon}`} style={{ marginRight: '5px' }} />
                    {totalRows} registro(s) encontrados
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="action-btn" onClick={exportCSV}
                    style={{ background: '#1cc88a', color: '#fff', fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-file-excel" /> Exportar CSV
                  </button>
                  <button className="action-btn" onClick={exportPDF}
                    style={{ background: '#e74a3b', color: '#fff', fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-file-pdf" /> Exportar PDF
                  </button>
                </div>
              </div>
            )}

            {/* Table / States */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', color: 'var(--primary-color)', opacity: 0.7 }} />
                <p style={{ marginTop: '16px', color: 'var(--gray-text)', fontSize: '14px' }}>Generando reporte…</p>
              </div>
            ) : !hasGenerated ? (
              <div style={{ textAlign: 'center', padding: '70px 20px' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(74,108,247,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '2rem', color: 'var(--primary-color)', opacity: 0.5 }} />
                </div>
                <p style={{ fontSize: '15px', color: 'var(--text-color)', fontWeight: 600 }}>Configura tus filtros y genera el reporte</p>
                <p style={{ fontSize: '13px', color: 'var(--gray-text)', marginTop: '6px' }}>
                  Usa el panel izquierdo para definir los filtros y haz clic en <strong>Generar Vista Previa</strong>
                </p>
              </div>
            ) : data.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <i className="fa-solid fa-box-open" style={{ fontSize: '2.5rem', color: '#bbb' }} />
                <p style={{ marginTop: '14px', color: 'var(--gray-text)', fontSize: '14px' }}>Sin resultados para los filtros aplicados</p>
              </div>
            ) : (
              <>
  <DataTableControls
                  pageSize={pageSize}
                  setPageSize={(v) => { setPageSize(v); setPage(1); }}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  totalItems={localFilteredData.length}
                  filteredItemsCount={paginatedData.length}
                  searchPlaceholder="Filtrar en resultados..."
                />
                <div className="table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table className="data-table" style={{ fontSize: '12px', width: '100%', minWidth: selectedFields.length > 8 ? '1200px' : 'auto' }}>
                    <thead>
                      <tr>
                        {fields.filter(f => selectedFields.includes(f.id)).map(f => (
                          <th key={f.id} style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((item, i) => (
                        <tr key={item.id || i}>
                          {fields.filter(f => selectedFields.includes(f.id)).map(f => (
                            <td key={f.id} style={{ maxWidth: '160px', minWidth: '60px', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {renderCell(f.id, item[f.id], selectedType)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  setPage={setPage}
                  totalPages={localTotalPages}
                  totalItems={localFilteredData.length}
                  pageSize={pageSize}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
