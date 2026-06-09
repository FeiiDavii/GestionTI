/**
 * Dashboard.jsx
 * Réplica fiel del motor dashboard-engine.js del sistema IAV2.
 * Usa HTML5 native DnD + CSS variables (--w-col-start, --w-col, etc.)
 * exactamente igual que el original.
 */
import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
);
ChartJS.defaults.font.family = "'Poppins', sans-serif";
ChartJS.defaults.color = '#666';

// ─── CATÁLOGO (idéntico al original) ─────────────────────────────────────────
const WIDGET_CATALOG = {
  kpi_pcs:              { name:'PCs Escritorio',         icon:'fa-desktop',                type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#84fab0', bgIcon:'rgba(132,250,176,0.15)' },
  kpi_portatiles:       { name:'Portátiles',             icon:'fa-laptop',                 type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#a18cd1', bgIcon:'rgba(161,140,209,0.15)' },
  kpi_impresoras:       { name:'Imp. y Escáneres',       icon:'fa-print',                  type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#fccb90', bgIcon:'rgba(252,203,144,0.15)' },
  kpi_licencias:        { name:'Licencias',              icon:'fa-key',                    type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#17a2b8', bgIcon:'rgba(23,162,184,0.15)'  },
  chart_area:           { name:'Top 5 Áreas (Equipos)',  icon:'fa-chart-bar',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'bar'     },
  chart_asign:          { name:'Asignaciones Activas',   icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'pie'     },
  chart_impresoras:     { name:'Top Marcas Impresión',   icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'doughnut'},
  chart_licarea:        { name:'Licencias por Área',     icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'pie'     },
  chart_software:       { name:'Distribución Software',  icon:'fa-chart-bar',              type:'chart', colSpan:12, rowSpan:2, req:'inv_ver',        chartType:'bar'     },
  kpi_tickets_abiertos: { name:'Tickets Abiertos',       icon:'fa-triangle-exclamation',   type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#e74a3b', bgIcon:'rgba(231,74,59,0.12)'   },
  kpi_tickets_proceso:  { name:'En Proceso',             icon:'fa-spinner',                type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#ffc107', bgIcon:'rgba(255,193,7,0.12)'   },
  kpi_tickets_hoy:      { name:'Creados Hoy',            icon:'fa-calendar-plus',          type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#1cc88a', bgIcon:'rgba(28,200,138,0.12)'  },
  kpi_satisfaccion:     { name:'Satisfacción',           icon:'fa-star',                   type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#ffc107', bgIcon:'rgba(255,193,7,0.12)'   },
  chart_tickets:        { name:'Estado de Tickets',      icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'tk_ver_global',  chartType:'doughnut'},
  chart_tickets_area:   { name:'Tickets por Área',       icon:'fa-chart-bar',              type:'chart', colSpan:6,  rowSpan:2, req:'tk_ver_global',  chartType:'bar'     },
  kpi_sla_cumplimiento: { name:'Cumplimiento SLA',       icon:'fa-check-circle',           type:'kpi',   colSpan:3,  rowSpan:1, req:'conf_basica',    defColor:'#28a745', bgIcon:'rgba(40,167,69,0.12)'   },
  kpi_sla_vencidos:     { name:'SLA Vencidos',           icon:'fa-clock',                  type:'kpi',   colSpan:3,  rowSpan:1, req:'conf_basica',    defColor:'#dc3545', bgIcon:'rgba(220,53,69,0.12)'   },
  kpi_sla_pendientes:   { name:'SLA Pendientes',         icon:'fa-hourglass-half',         type:'kpi',   colSpan:3,  rowSpan:1, req:'conf_basica',    defColor:'#ffc107', bgIcon:'rgba(255,193,7,0.12)'   },
  chart_sla_prioridad:  { name:'SLA por Prioridad',      icon:'fa-chart-bar',              type:'chart', colSpan:6,  rowSpan:2, req:'conf_basica',    chartType:'bar'     },
  list_sla_proximos:    { name:'SLA Próximos a Vencer',  icon:'fa-clock',                  type:'list',  colSpan:6,  rowSpan:2, req:'conf_basica'                         },
  list_auditoria:       { name:'Actividad Reciente',     icon:'fa-clipboard-list',         type:'list',  colSpan:12, rowSpan:2, req:'rep_generar'                         },
  widget_texto:         { name:'Nota / Texto',           icon:'fa-font',                   type:'texto', colSpan:6,  rowSpan:1, req:'any'                                 },
};

const CHART_COLORS_PIE  = ['#ff9f43','#fccb90','#e74a3b','#1cc88a','#4a6cf7','#3db9dc'];
const CHART_COLOR_BAR   = '#4a6cf7';

// ─── PERMISOS ─────────────────────────────────────────────────────────────────
function hasPermission(req, permisos) {
  if (req === 'any') return true;
  if (req === 'tk_ver_global') return !!(permisos.tk_ver_global || permisos.tk_responder);
  if (req === 'rep_generar')   return !!(permisos.rep_generar || permisos.conf_basica || permisos.usr_ver);
  return !!permisos[req];
}

// ─── CONFIG POR DEFECTO (idéntica a buildDefaultConfig del original) ──────────
function buildDefaultConfig(permisos) {
  const widgets = [];
  let order = 0;
  const ts = Date.now();

  if (hasPermission('inv_ver', permisos)) {
    widgets.push({ id:`w_${ts}_1`, type:'kpi_pcs',        colStart:1,  colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_2`, type:'kpi_portatiles',  colStart:4,  colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_3`, type:'kpi_impresoras',  colStart:7,  colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_4`, type:'kpi_licencias',   colStart:10, colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_5`, type:'chart_area',      colStart:1,  colSpan:6,  rowSpan:2, order:order++ });
    widgets.push({ id:`w_${ts}_6`, type:'chart_asign',     colStart:7,  colSpan:6,  rowSpan:2, order:order++ });
  }
  if (hasPermission('tk_ver_global', permisos)) {
    widgets.push({ id:`w_${ts}_7`,  type:'kpi_tickets_abiertos', colStart:1,  colSpan:3, rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_8`,  type:'kpi_tickets_proceso',  colStart:4,  colSpan:3, rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_9`,  type:'kpi_tickets_hoy',      colStart:7,  colSpan:3, rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_10`, type:'kpi_satisfaccion',     colStart:10, colSpan:3, rowSpan:1, order:order++ });
  }
  if (hasPermission('rep_generar', permisos)) {
    widgets.push({ id:`w_${ts}_11`, type:'list_auditoria', colStart:1, colSpan:12, rowSpan:2, order:order++ });
  }
  return { version:1, widgets };
}

// ─── COLISIONES (idéntico al original) ───────────────────────────────────────
function resolveCollisions(widgets, anchorId = null) {
  const sorted = [...widgets].sort((a, b) => {
    if (a.id === anchorId) return -1;
    if (b.id === anchorId) return 1;
    if ((a.rowStart||1) !== (b.rowStart||1)) return (a.rowStart||1) - (b.rowStart||1);
    return (a.colStart||1) - (b.colStart||1);
  });

  const placed = [];
  for (const w of sorted) {
    if (!w.colStart) w.colStart = 1;
    if (!w.rowStart) w.rowStart = 1;
    let collides = true, iterations = 0;
    while (collides && iterations < 100) {
      collides = false; iterations++;
      for (const p of placed) {
        const r1 = { x1:w.colStart, x2:w.colStart+w.colSpan, y1:w.rowStart, y2:w.rowStart+w.rowSpan };
        const r2 = { x1:p.colStart, x2:p.colStart+p.colSpan, y1:p.rowStart, y2:p.rowStart+p.rowSpan };
        if (r1.x1 < r2.x2 && r1.x2 > r2.x1 && r1.y1 < r2.y2 && r1.y2 > r2.y1) {
          collides = true;
          w.rowStart = p.rowStart + p.rowSpan;
          break;
        }
      }
    }
    placed.push(w);
  }
  return placed;
}

// ─── GRID CELL DESDE EVENTO (idéntico al original) ───────────────────────────
function getGridCellFromEvent(e, canvas) {
  const rect  = canvas.getBoundingClientRect();
  const style = window.getComputedStyle(canvas);
  const gap   = parseInt(style.gap) || 16;
  const colWidth  = (rect.width + gap) / 12;
  const rowHeight = 120 + gap;
  const x = e.clientX - rect.left - (canvas.classList.contains('edit-mode') ? 16 : 0);
  const y = e.clientY - rect.top  - (canvas.classList.contains('edit-mode') ? 16 : 0);
  return {
    col: Math.max(1, Math.min(12, Math.floor(x / colWidth) + 1)),
    row: Math.max(1, Math.floor(y / rowHeight) + 1)
  };
}

// ─── WIDGET CHART ─────────────────────────────────────────────────────────────
// Usa react-chartjs-2 en lugar de new ChartJS() imperativo.
// react-chartjs-2 maneja correctamente el ciclo de vida de React StrictMode.
function WidgetChart({ chartType, rowSpan, data }) {
  const cType  = chartType || 'bar';
  const isPie  = cType === 'pie' || cType === 'doughnut';
  const height = Math.max(100, (rowSpan || 2) * 100);

  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      data: data?.values || [],
      backgroundColor: isPie ? CHART_COLORS_PIE : CHART_COLOR_BAR,
      borderColor: '#fff',
      borderWidth: 1,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: isPie, position: 'right' }
    },
    ...(cType === 'bar' || cType === 'line' ? {
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } }
    } : {})
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      {cType === 'pie'      && <Pie      data={chartData} options={options} />}
      {cType === 'doughnut' && <Doughnut data={chartData} options={options} />}
      {cType === 'line'     && <Line     data={chartData} options={options} />}
      {(cType === 'bar' || (cType !== 'pie' && cType !== 'doughnut' && cType !== 'line')) &&
        <Bar data={chartData} options={options} />
      }
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, permisos, esAdministrativo } = useAuth();

  // Estado del dashboard
  const [config, setConfig]       = useState({ version:1, widgets:[] });
  const [dashData, setDashData]   = useState(null);   // { inventory, support, audit, sla }
  const [loading, setLoading]     = useState(true);
  const [lastSaved, setLastSaved] = useState('No guardado');

  // Estado de edición
  const [isEditMode, setIsEditMode]   = useState(false);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [panelTab, setPanelTab]       = useState('catalog');
  const [selectedId, setSelectedId]   = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('');

  // Estado drag & drop (HTML5 native, igual que el original)
  const [draggedId, setDraggedId]         = useState(null);
  const [placeholder, setPlaceholder]     = useState(null); // { col, row, colSpan, rowSpan }

  const canvasRef    = useRef(null);
  const configRef    = useRef(config);
  const saveTimer    = useRef(null);
  const canvasDragInit = useRef(false);

  configRef.current = config;

  const selectedWidget = config.widgets.find(w => w.id === selectedId) || null;

  // ── Carga inicial ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [dataRes, slaRes] = await Promise.all([
        dashboardAPI.data(),
        dashboardAPI.slaStats()
      ]);
      if (dataRes.data.success) {
        const d = dataRes.data.data;
        d.sla = slaRes.data.success ? slaRes.data.data : null;
        setDashData(d);
      }
    } catch { /* silencioso */ }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await dashboardAPI.config();
      if (res.data.success) {
        const saved = res.data.data;
        if (saved?.widgets?.length > 0) {
          // Migración: si falta colStart/rowStart, resolver colisiones
          let needsMigration = saved.widgets.some(w => !w.colStart || !w.rowStart);
          let widgets = saved.widgets;
          if (needsMigration) widgets = resolveCollisions(widgets);
          setConfig({ version: saved.version || 1, widgets });
        } else {
          setConfig(buildDefaultConfig(permisos));
        }
      } else {
        setConfig(buildDefaultConfig(permisos));
      }
    } catch {
      setConfig(buildDefaultConfig(permisos));
    }
    setLoading(false);
  }, [permisos]);

  useEffect(() => {
    loadConfig();
    fetchData();
  }, [loadConfig, fetchData]);

  // SSE: recargar datos cuando el sistema se actualiza
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('rt:system_update', handler);
    return () => window.removeEventListener('rt:system_update', handler);
  }, [fetchData]);

  // ── Guardado con debounce (igual que queueSave del original) ───────────────
  const queueSave = useCallback((cfg, message = null) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await dashboardAPI.saveConfig({ config: cfg || configRef.current });
        if (res.data.success) {
          const savedAt = res.data.data?.savedAt || new Date().toLocaleTimeString();
          setLastSaved(savedAt);
          if (message) {
            showToast(message, 'success');
          }
        }
      } catch { /* silencioso */ }
    }, 1000);
  }, []);

  // ── Helpers de config ───────────────────────────────────────────────────────
  const updateConfig = useCallback((newWidgets, anchorId = null, message = null) => {
    const resolved = resolveCollisions(newWidgets, anchorId);
    const newCfg = { ...configRef.current, widgets: resolved };
    setConfig(newCfg);
    queueSave(newCfg, message);
    return resolved;
  }, [queueSave]);

  // ── Sincronizar clases body (igual que el original usa body.edit-mode) ───────
  useEffect(() => {
    document.body.classList.toggle('edit-mode', isEditMode);
    return () => document.body.classList.remove('edit-mode');
  }, [isEditMode]);

  useEffect(() => {
    document.body.classList.toggle('panel-is-open', panelOpen);
    return () => document.body.classList.remove('panel-is-open');
  }, [panelOpen]);

  // ── Toggle edit mode ────────────────────────────────────────────────────────
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => {
      const next = !prev;
      if (!next) {
        setPanelOpen(false);
        setSelectedId(null);
        queueSave(configRef.current, 'Configuración del dashboard guardada');
      }
      return next;
    });
  }, [queueSave]);

  // ── Añadir widget ───────────────────────────────────────────────────────────
  const addWidget = useCallback((typeId, colStart = null, rowStart = null) => {
    const cat = WIDGET_CATALOG[typeId];
    if (!cat) return;
    const widgets = configRef.current.widgets;

    // Si no se especifica posición, colocar al final (igual que addWidget del original)
    let cs = colStart || 1;
    let rs = rowStart;
    if (!rs) {
      let maxRow = 1;
      widgets.forEach(w => { if (w.rowStart + w.rowSpan > maxRow) maxRow = w.rowStart + w.rowSpan; });
      rs = maxRow;
    }

    const newW = {
      id: `w_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
      type: typeId,
      colStart: Math.min(cs, 13 - cat.colSpan),
      colSpan: cat.colSpan,
      rowStart: rs,
      rowSpan: cat.rowSpan,
      order: widgets.length,
      config: {}
    };
    updateConfig([...widgets, newW], newW.id);
  }, [updateConfig]);

  // ── Eliminar widget ─────────────────────────────────────────────────────────
  const deleteWidget = useCallback((id) => {
    Swal.fire({
      title:'¿Eliminar widget?', text:'Desaparecerá del dashboard.',
      icon:'warning', showCancelButton:true,
      confirmButtonColor:'#dc3545', confirmButtonText:'Sí, eliminar', cancelButtonText:'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        const newWidgets = configRef.current.widgets.filter(w => w.id !== id);
        updateConfig(newWidgets, null, 'Widget eliminado del dashboard');
        if (selectedId === id) { setSelectedId(null); setPanelTab('catalog'); }
      }
    });
  }, [updateConfig, selectedId]);

  // ── Aplicar edición de widget ───────────────────────────────────────────────
  const applyEdit = useCallback((id, changes) => {
    const newWidgets = configRef.current.widgets.map(w => {
      if (w.id !== id) return w;
      const merged = { ...w };
      // Cambios de tamaño van directo al widget
      if (changes.colSpan !== undefined) merged.colSpan = changes.colSpan;
      if (changes.rowSpan !== undefined) merged.rowSpan = changes.rowSpan;
      // Cambios de config van al sub-objeto config
      merged.config = { ...(w.config || {}), ...changes.config };
      return merged;
    });
    updateConfig(newWidgets, id);
  }, [updateConfig]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetToDefault = useCallback(() => {
    Swal.fire({
      title:'¿Restablecer dashboard?',
      text:'Se perderá toda tu configuración actual y volverá al diseño por defecto.',
      icon:'warning', showCancelButton:true,
      confirmButtonColor:'#4a6cf7', cancelButtonColor:'#6c757d',
      confirmButtonText:'Sí, restablecer', cancelButtonText:'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        const def = buildDefaultConfig(permisos);
        setConfig(def);
        queueSave(def, 'Dashboard restablecido a configuración por defecto');
        setPanelOpen(false);
      }
    });
  }, [permisos, queueSave]);

  // ── HTML5 DnD — dragstart en widget ────────────────────────────────────────
  const handleDragStart = useCallback((e, widgetId) => {
    if (!isEditMode) { e.preventDefault(); return; }
    setDraggedId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
    const w = configRef.current.widgets.find(x => x.id === widgetId);
    if (w) setPlaceholder({ col:w.colStart, row:w.rowStart, colSpan:w.colSpan, rowSpan:w.rowSpan });
  }, [isEditMode]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setPlaceholder(null);
  }, []);

  // ── HTML5 DnD — dragover en canvas ─────────────────────────────────────────
  const handleCanvasDragOver = useCallback((e) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedId ? 'move' : 'copy';

    // Edge scrolling (igual que el original)
    const margin = 150, speed = 20;
    if (e.clientY < margin) window.scrollBy(0, -speed);
    else if (window.innerHeight - e.clientY < margin) window.scrollBy(0, speed);

    if (!canvasRef.current) return;
    const isCatalog = e.dataTransfer.types.includes('application/catalog-id');
    const wId = draggedId || (isCatalog ? null : null);

    let colSpan = 3, rowSpan = 1;
    if (wId) {
      const wObj = configRef.current.widgets.find(w => w.id === wId);
      if (wObj) { colSpan = wObj.colSpan; rowSpan = wObj.rowSpan; }
    } else if (isCatalog) {
      const typeId = e.dataTransfer.getData('application/catalog-id');
      const cat = WIDGET_CATALOG[typeId];
      if (cat) { colSpan = cat.colSpan; rowSpan = cat.rowSpan; }
    }

    const cell = getGridCellFromEvent(e, canvasRef.current);
    const safeCol = Math.min(cell.col, 13 - colSpan);
    setPlaceholder(prev => {
      if (prev?.col === safeCol && prev?.row === cell.row) return prev;
      return { col:safeCol, row:cell.row, colSpan, rowSpan };
    });
  }, [isEditMode, draggedId]);

  const handleCanvasDragLeave = useCallback((e) => {
    if (e.relatedTarget && canvasRef.current?.contains(e.relatedTarget)) return;
    setPlaceholder(null);
  }, []);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    setPlaceholder(null);
    if (!isEditMode || !canvasRef.current) return;

    const cell = getGridCellFromEvent(e, canvasRef.current);

    // Drop de widget existente
    if (draggedId) {
      const wObj = configRef.current.widgets.find(w => w.id === draggedId);
      if (wObj) {
        const safeCol = Math.min(cell.col, 13 - wObj.colSpan);
        const newWidgets = configRef.current.widgets.map(w =>
          w.id === draggedId ? { ...w, colStart:safeCol, rowStart:cell.row } : w
        );
        updateConfig(newWidgets, draggedId);
      }
      setDraggedId(null);
      return;
    }

    // Drop desde catálogo
    if (e.dataTransfer.types.includes('application/catalog-id')) {
      const typeId = e.dataTransfer.getData('application/catalog-id');
      const cat = WIDGET_CATALOG[typeId];
      if (cat) {
        const safeCol = Math.min(cell.col, 13 - cat.colSpan);
        addWidget(typeId, safeCol, cell.row);
      }
    }
  }, [isEditMode, draggedId, updateConfig, addWidget]);

  // ── Catalog drag start ──────────────────────────────────────────────────────
  const handleCatalogDragStart = useCallback((e, typeId) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/catalog-id', typeId);
    e.dataTransfer.setData('text/plain', 'CATALOG:' + typeId);
    const cat = WIDGET_CATALOG[typeId];
    if (cat) setPlaceholder({ col:1, row:1, colSpan:cat.colSpan, rowSpan:cat.rowSpan });
  }, []);

  // ── Resize (idéntico al original: mousedown en handle) ─────────────────────
  const handleResizeMouseDown = useCallback((e, widgetId) => {
    if (!isEditMode) return;
    e.preventDefault(); e.stopPropagation();

    const wObj = configRef.current.widgets.find(w => w.id === widgetId);
    if (!wObj) return;

    const startX = e.clientX, startY = e.clientY;
    const startColSpan = wObj.colSpan, startRowSpan = wObj.rowSpan;

    const onMouseMove = (ev) => {
      if (!canvasRef.current) return;
      const style    = window.getComputedStyle(canvasRef.current);
      const gap      = parseInt(style.gap) || 16;
      const colWidth = (canvasRef.current.offsetWidth + gap) / 12;
      const rowHeight = 120 + gap;

      const colDelta = Math.round((ev.clientX - startX) / colWidth);
      const rowDelta = Math.round((ev.clientY - startY) / rowHeight);

      const maxCol = 13 - (wObj.colStart || 1);
      const newColSpan = Math.max(1, Math.min(maxCol, startColSpan + colDelta));
      const newRowSpan = Math.max(1, Math.min(4, startRowSpan + rowDelta));

      // Actualizar solo el widget en resize (sin resolver colisiones durante el drag)
      setConfig(prev => ({
        ...prev,
        widgets: prev.widgets.map(w =>
          w.id === widgetId ? { ...w, colSpan:newColSpan, rowSpan:newRowSpan } : w
        )
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Al soltar: resolver colisiones y guardar
      setConfig(prev => {
        const resolved = resolveCollisions(prev.widgets, widgetId);
        const newCfg = { ...prev, widgets: resolved };
        queueSave(newCfg);
        return newCfg;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isEditMode, queueSave]);

  // ── Datos para cada widget (memoizados) ─────────────────────────────────────
  const getKpiData = useCallback((type) => {
    let val = 0, sub = '', pct = 0;
    if (dashData?.inventory) {
      const inv = dashData.inventory;
      const totEq = inv.totalEquipos || 1;
      if (type==='kpi_pcs')        { val=inv.totalPCs;        sub='Total equipos'; pct=(val/totEq)*100; }
      if (type==='kpi_portatiles') { val=inv.totalPortatiles; sub='Total equipos'; pct=(val/totEq)*100; }
      if (type==='kpi_impresoras') { val=inv.totalImpresoras; sub='Total equipos'; pct=(val/totEq)*100; }
      if (type==='kpi_licencias')  { val=inv.totalLicencias;  sub=`${inv.licenciasLibres} Libres`; pct=inv.totalLicencias>0?((inv.totalLicencias-inv.licenciasLibres)/inv.totalLicencias)*100:0; }
    }
    if (dashData?.support) {
      const sup = dashData.support;
      if (type==='kpi_tickets_abiertos') { val=sup.ticketsAbiertos;      sub='Pendientes';  pct=100; }
      if (type==='kpi_tickets_proceso')  { val=sup.ticketsProceso;       sub='En revisión'; pct=100; }
      if (type==='kpi_tickets_hoy')      { val=sup.ticketsHoy;           sub='Hoy';         pct=100; }
      if (type==='kpi_satisfaccion')     { val=sup.promedioSatisfaccion; sub='Sobre 5.0';   pct=(val/5)*100; }
    }
    if (dashData?.sla) {
      const sla = dashData.sla;
      if (type==='kpi_sla_cumplimiento') { val=sla.porcentaje_cumplimiento; sub='% Cumplimiento'; pct=val; }
      if (type==='kpi_sla_vencidos')     { val=sla.incumplidos_resolucion;  sub='Vencidos';       pct=100; }
      if (type==='kpi_sla_pendientes')   { val=sla.pendientes;              sub='Pendientes';     pct=100; }
    }
    return { val, sub, pct: Math.min(Math.max(pct, 0), 100) };
  }, [dashData]);

  // Precalcular todos los datos de charts de una vez con useMemo
  // Así cada chart recibe el mismo objeto referencia si los datos no cambiaron
  const allChartData = useMemo(() => {
    const result = {};
    if (dashData?.inventory?.charts) {
      const c = dashData.inventory.charts;
      if (c.area)    result.chart_area       = { labels: c.area.map(x=>x.label),    values: c.area.map(x=>x.value) };
      if (c.asign)   result.chart_asign      = { labels: c.asign.map(x=>x.label),   values: c.asign.map(x=>x.value) };
      if (c.imp)     result.chart_impresoras = { labels: c.imp.map(x=>x.label),     values: c.imp.map(x=>x.value) };
      if (c.licArea) result.chart_licarea    = { labels: c.licArea.map(x=>x.label), values: c.licArea.map(x=>x.value) };
      if (c.soft)    result.chart_software   = { labels: c.soft.map(x=>x.label),    values: c.soft.map(x=>x.value) };
    }
    if (dashData?.support?.charts) {
      const c = dashData.support.charts;
      if (c.tickets)     result.chart_tickets      = { labels: c.tickets.labels,              values: c.tickets.data };
      if (c.ticketsArea) result.chart_tickets_area = { labels: c.ticketsArea.map(x=>x.label), values: c.ticketsArea.map(x=>x.value) };
    }
    if (dashData?.sla?.por_prioridad) {
      result.chart_sla_prioridad = {
        labels: dashData.sla.por_prioridad.map(x=>x.prioridad_ticket),
        values: dashData.sla.por_prioridad.map(x=>x.total)
      };
    }
    return result;
  }, [dashData]);

  const getChartData = useCallback((type) => {
    return allChartData[type] || { labels: [], values: [] };
  }, [allChartData]);

  // ── Renderizado de contenido de widget ──────────────────────────────────────
  const renderWidgetBody = useCallback((w) => {
    const cat = WIDGET_CATALOG[w.type];
    if (!cat) return null;
    const conf = w.config || {};

    if (cat.type === 'kpi') {
      const { val, sub, pct } = getKpiData(w.type);
      const color = conf.color || cat.defColor || 'var(--primary-color)';
      return (
        <>
          <div className="kpi-row">
            <div>
              <div className="kpi-value-big">{val}</div>
              <div className="kpi-sub">{sub || cat.name}</div>
            </div>
            <div className="kpi-icon-box" style={{ background: cat.bgIcon || 'rgba(0,0,0,0.05)', color }}>
              <i className={`fa-solid ${conf.icon || cat.icon}`}></i>
            </div>
          </div>
          <div className="w-progress-bg">
            <div className="w-progress-fill" style={{ width:`${pct}%`, background:color }}></div>
          </div>
        </>
      );
    }

    if (cat.type === 'chart') {
      // Los charts se renderizan directamente en el JSX del widget (no desde aquí)
      // para que React mantenga la identidad del componente WidgetChart estable.
      return null;
    }

    if (cat.type === 'list' && w.type === 'list_auditoria') {
      const audit = dashData?.audit || [];
      const iconMap = { usuarios:'fa-user', equipos_de_computo:'fa-computer', licencias:'fa-windows', tickets:'fa-ticket' };
      return (
        <ul className="w-activity-list">
          {audit.length === 0
            ? <li style={{ textAlign:'center', padding:'20px', color:'var(--gray-text)' }}>Sin actividad reciente</li>
            : audit.map((a, i) => {
                const tabla = (a.tabla||'').replace(/_/g,' ');
                const icon  = iconMap[a.tabla] || 'fa-file-pen';
                const f     = a.fecha ? new Date(a.fecha.replace(' ','T')) : null;
                const fStr  = f ? `${f.getDate()} ${f.toLocaleString('es',{month:'short'})} - ${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}` : '';
                // Sanitizar descripción (no mostrar SQL crudo)
                let desc = a.descripcion || '';
                if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/i.test(desc)) desc = 'Acción del sistema';
                if (desc.length > 80) desc = desc.substring(0,80) + '…';
                return (
                  <li key={i}>
                    <div className="w-activity-icon"><i className={`fa-solid ${icon}`}></i></div>
                    <div className="w-activity-content">
                      <div className="w-activity-title">{desc}</div>
                      <div className="w-activity-meta">{tabla} • {fStr}</div>
                    </div>
                  </li>
                );
              })
          }
        </ul>
      );
    }

    if (cat.type === 'list' && w.type === 'list_sla_proximos') {
      const slaList = dashData?.sla?.proximos_a_vencer || [];
      return (
        <ul className="w-activity-list">
          {slaList.length === 0
            ? <li style={{ textAlign:'center', padding:'20px', color:'var(--gray-text)' }}>No hay SLAs próximos a vencer</li>
            : slaList.map((sla, i) => {
                const f = new Date(sla.fecha_limite_resolucion.replace(' ','T'));
                const fStr = `${f.getDate()} ${f.toLocaleString('es',{month:'short'})} - ${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}`;
                return (
                  <li key={i}>
                    <div className="w-activity-icon"><i className="fa-solid fa-clock"></i></div>
                    <div className="w-activity-content">
                      <div className="w-activity-title">Ticket #{sla.id}</div>
                      <div className="w-activity-meta">{sla.titulo}</div>
                      <div className="w-activity-meta">{sla.prioridad} • Vence: {fStr}</div>
                    </div>
                  </li>
                );
              })
          }
        </ul>
      );
    }

    if (cat.type === 'texto') {
      return <div className="w-text-content">{conf.content || 'Sin contenido. Edita el widget para añadir texto.'}</div>;
    }

    return null;
  }, [getKpiData, getChartData, dashData]);

  // ── Panel editor de widget ──────────────────────────────────────────────────
  const renderEditor = useCallback(() => {
    if (!selectedWidget) {
      return (
        <div className="editor-no-selection">
          <i className="fa-solid fa-hand-pointer"></i>
          <p>Selecciona el ícono <i className="fa-solid fa-gear"></i> de cualquier widget en el dashboard para editarlo.</p>
        </div>
      );
    }
    const cat  = WIDGET_CATALOG[selectedWidget.type];
    const conf = selectedWidget.config || {};
    const title    = conf.title    || cat?.name || '';
    const color    = conf.color    || cat?.defColor || '#4a6cf7';
    const colSpan  = selectedWidget.colSpan;
    const rowSpan  = selectedWidget.rowSpan;
    const cType    = conf.chartType || cat?.chartType || 'bar';

    return (
      <div className="editor-form">
        <div className="editor-section-title">Editando: {cat?.name}</div>

        <div className="form-group">
          <label>Título visible</label>
          <input type="text" className="form-control" defaultValue={title}
            onBlur={(e) => applyEdit(selectedWidget.id, { config:{ title: e.target.value } })} />
        </div>

        <div className="form-group">
          <label>Color de acento</label>
          <div className="color-row">
            <input type="color" defaultValue={color}
              onChange={(e) => applyEdit(selectedWidget.id, { config:{ color: e.target.value } })} />
            <span className="color-preview">{color}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Tamaño (Columnas 1-12)</label>
          <div className="range-wrap">
            <input type="range" min="1" max="12" defaultValue={colSpan}
              onChange={(e) => applyEdit(selectedWidget.id, { colSpan: parseInt(e.target.value) })} />
            <span className="range-val">{colSpan}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Altura (Filas 1-4)</label>
          <div className="range-wrap">
            <input type="range" min="1" max="4" defaultValue={rowSpan}
              onChange={(e) => applyEdit(selectedWidget.id, { rowSpan: parseInt(e.target.value) })} />
            <span className="range-val">{rowSpan}</span>
          </div>
        </div>

        {cat?.type === 'chart' && (
          <div className="form-group">
            <label>Tipo de Gráfica</label>
            <select className="form-control" defaultValue={cType}
              onChange={(e) => applyEdit(selectedWidget.id, { config:{ chartType: e.target.value } })}>
              <option value="bar">Barras</option>
              <option value="pie">Pastel (Pie)</option>
              <option value="doughnut">Dona (Doughnut)</option>
              <option value="line">Línea</option>
            </select>
          </div>
        )}

        {cat?.type === 'texto' && (
          <div className="form-group">
            <label>Contenido</label>
            <textarea className="form-control" rows="4" defaultValue={conf.content || ''}
              onBlur={(e) => applyEdit(selectedWidget.id, { config:{ content: e.target.value } })} />
          </div>
        )}

        <div className="editor-actions">
          <button className="dash-btn dash-btn-danger" style={{ width:'100%' }}
            onClick={() => deleteWidget(selectedWidget.id)}>
            <i className="fa-solid fa-trash"></i> Eliminar Widget
          </button>
        </div>
      </div>
    );
  }, [selectedWidget, applyEdit, deleteWidget]);

  // ── Catálogo filtrado ───────────────────────────────────────────────────────
  const catalogItems = useMemo(() => {
    const groups = { kpi:[], chart:[], other:[] };
    Object.entries(WIDGET_CATALOG).forEach(([key, cat]) => {
      if (!hasPermission(cat.req, permisos)) return;
      if (catalogFilter && !cat.name.toLowerCase().includes(catalogFilter.toLowerCase())) return;
      const g = cat.type === 'kpi' ? 'kpi' : cat.type === 'chart' ? 'chart' : 'other';
      groups[g].push({ id:key, ...cat });
    });
    return groups;
  }, [permisos, catalogFilter]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!esAdministrativo()) {
    return <Navigate to="/tickets" replace />;
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize:'2.5rem', color:'var(--primary-color)' }}></i>
      </div>
    );
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Barra de edición */}
      <div id="dashboard-edit-bar" className={`${isEditMode ? 'visible' : ''} ${panelOpen ? 'panel-open' : ''}`}>
        <div className="bar-title">
          <i className="fa-solid fa-pen-ruler"></i> Modo Edición Activo
        </div>
        <button className="dash-btn dash-btn-secondary"
          onClick={() => { setPanelOpen(true); setPanelTab('catalog'); }}>
          <i className="fa-solid fa-plus"></i> Añadir Widget
        </button>
        <button className="dash-btn dash-btn-primary" onClick={toggleEditMode}>
          <i className="fa-solid fa-floppy-disk"></i> Guardar Cambios
        </button>
      </div>

      {/* Canvas — CSS variables igual que el original */}
      <div
        id="dashboard-canvas"
        ref={canvasRef}
        className={`${isEditMode ? 'edit-mode' : ''} ${panelOpen ? 'panel-open' : ''}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
      >
        {config.widgets.length === 0 ? (
          <div className="dash-empty-msg" style={{ display:'block', gridColumn:'1 / -1' }}>
            <i className="fa-solid fa-puzzle-piece"></i>
            <p>El dashboard está vacío.<br />Haz clic en "Editar Dashboard" para añadir widgets.</p>
          </div>
        ) : (
          [...config.widgets]
            .sort((a, b) => (a.order||0) - (b.order||0))
            .map(w => {
              const cat = WIDGET_CATALOG[w.type];
              if (!cat) return null;
              if (!hasPermission(cat.req, permisos)) return null;
              const conf  = w.config || {};
              const title = conf.title || cat.name;
              const icon  = conf.icon  || cat.icon;
              const color = conf.color || cat.defColor || 'var(--primary-color)';
              const isDragging = draggedId === w.id;

              return (
                <div
                  key={w.id}
                  id={`widget-${w.id}`}
                  className={`dash-widget wtype-${cat.type}${isEditMode ? ' edit-mode' : ''}${isDragging ? ' is-dragging' : ''}${isEditMode && selectedId === w.id ? ' is-selected' : ''}`}
                  draggable={isEditMode}
                  style={{
                    '--w-col-start': w.colStart || 'auto',
                    '--w-row-start': w.rowStart || 'auto',
                    '--w-col': w.colSpan,
                    '--w-row': w.rowSpan,
                  }}
                  onDragStart={(e) => handleDragStart(e, w.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => { if (isEditMode) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                  onClick={(e) => {
                    if (!isEditMode) return;
                    if (e.target.closest('.wctrl-btn') || e.target.closest('.dash-widget-resize')) return;
                    setSelectedId(w.id);
                    setPanelTab('edit');
                    setPanelOpen(true);
                  }}
                >
                  {/* Header */}
                  <div className="dash-widget-header">
                    <div className="dash-widget-title">
                      <i className={`fa-solid ${icon}`} style={{ color }}></i>
                      <span>{title}</span>
                    </div>
                    <div className="dash-widget-controls">
                      <button className="wctrl-btn wctrl-edit" title="Configurar"
                        onClick={(e) => { e.stopPropagation(); setSelectedId(w.id); setPanelTab('edit'); setPanelOpen(true); }}>
                        <i className="fa-solid fa-gear"></i>
                      </button>
                      <button className="wctrl-btn wctrl-delete" title="Eliminar"
                        onClick={(e) => { e.stopPropagation(); deleteWidget(w.id); }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="dash-widget-body">
                    {cat.type === 'chart' ? (
                      <WidgetChart
                        chartType={conf.chartType || cat.chartType || 'bar'}
                        rowSpan={w.rowSpan}
                        data={getChartData(w.type)}
                      />
                    ) : (
                      renderWidgetBody(w)
                    )}
                  </div>

                  {/* Resize handle */}
                  <div className="dash-widget-resize"
                    onMouseDown={(e) => handleResizeMouseDown(e, w.id)}>
                    <i className="fa-solid fa-up-right-and-down-left-from-center"
                      style={{ transform:'rotate(90deg)' }}></i>
                  </div>
                </div>
              );
            })
        )}

        {/* Placeholder de drop */}
        {isEditMode && placeholder && (
          <div
            className="dash-placeholder"
            style={{
              '--p-col-start': placeholder.col,
              '--p-row-start': placeholder.row,
              '--p-col': placeholder.colSpan,
              '--p-row': placeholder.rowSpan,
              display: 'block',
            }}
          />
        )}
      </div>

      {/* Botón flotante editar */}
      <button
        id="btn-toggle-edit"
        className={isEditMode ? 'active' : ''}
        onClick={toggleEditMode}
        title={isEditMode ? 'Guardar y salir del modo edición' : 'Personalizar Dashboard'}
      >
        <i className={`fa-solid ${isEditMode ? 'fa-times' : 'fa-pen'}`}></i>
      </button>

      {/* Panel lateral */}
      <div id="dashboard-panel" className={panelOpen ? 'open' : ''}>
        <div className="panel-header">
          <h3><i className="fa-solid fa-palette"></i> Panel de Control</h3>
          <button className="panel-close" onClick={() => setPanelOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="panel-tabs">
          {[
            { key:'catalog',  icon:'fa-cubes',   label:'Catálogo' },
            { key:'edit',     icon:'fa-gear',    label:'Editor'   },
            { key:'settings', icon:'fa-sliders', label:'Ajustes'  },
          ].map(tab => (
            <div key={tab.key}
              className={`panel-tab ${panelTab === tab.key ? 'active' : ''}`}
              onClick={() => setPanelTab(tab.key)}>
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </div>
          ))}
        </div>

        <div className="panel-body">

          {/* ── Catálogo ── */}
          {panelTab === 'catalog' && (
            <div className="panel-view active">
              <div className="catalog-search">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input type="text" placeholder="Buscar widgets..."
                  value={catalogFilter}
                  onChange={(e) => setCatalogFilter(e.target.value)} />
              </div>

              {[
                { key:'kpi',   label:'Indicadores (KPI)' },
                { key:'chart', label:'Gráficas'           },
                { key:'other', label:'Otros'              },
              ].map(({ key, label }) => {
                const items = catalogItems[key];
                if (!items?.length) return null;
                return (
                  <div key={key}>
                    <div className="catalog-group-title">{label}</div>
                    {items.map(item => (
                      <div key={item.id} className="catalog-item"
                        draggable
                        onDragStart={(e) => handleCatalogDragStart(e, item.id)}>
                        <div className="catalog-item-icon">
                          <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div className="catalog-item-info">
                          <strong>{item.name}</strong>
                          <span>{item.colSpan}×{item.rowSpan} celdas</span>
                        </div>
                        <button className="catalog-add-btn"
                          onClick={() => addWidget(item.id)}>
                          <i className="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Editor ── */}
          {panelTab === 'edit' && (
            <div className="panel-view active">
              {renderEditor()}
            </div>
          )}

          {/* ── Ajustes ── */}
          {panelTab === 'settings' && (
            <div className="panel-view active">
              <div className="settings-info-row">
                <span>Último guardado:</span>
                <strong>{lastSaved}</strong>
              </div>
              <div className="panel-action-row" style={{ marginTop:'20px' }}>
                <button className="dash-btn dash-btn-danger" style={{ width:'100%' }}
                  onClick={resetToDefault}>
                  <i className="fa-solid fa-rotate-left"></i> Restablecer al diseño por defecto
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
