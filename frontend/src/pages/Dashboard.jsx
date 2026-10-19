/**
 * Dashboard.jsx
 * Consola interactiva de indicadores y gráficas en tiempo real (Estética Invester).
 * Soporta Drag & Drop HTML5 nativo, redimensionamiento en grilla de 12 columnas y personalización por usuario.
 */
import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../api/client';
import { showToast, showConfirm } from '../core/toast';
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
ChartJS.defaults.font.family = "'DM Sans', sans-serif";

// ─── CATÁLOGO DE WIDGETS ──────────────────────────────────────────────────────
const WIDGET_CATALOG = {
  kpi_pcs:              { name:'PCs Escritorio',         icon:'fa-desktop',                type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#2563eb', bgIcon:'rgba(37,99,235,0.11)' },
  kpi_portatiles:       { name:'Portátiles',             icon:'fa-laptop',                 type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#10b981', bgIcon:'rgba(16,185,129,0.11)' },
  kpi_impresoras:       { name:'Imp. y Escáneres',       icon:'fa-print',                  type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#0ea5e9', bgIcon:'rgba(14,165,233,0.11)' },
  kpi_licencias:        { name:'Licencias',              icon:'fa-key',                    type:'kpi',   colSpan:3,  rowSpan:1, req:'inv_ver',        defColor:'#f59e0b', bgIcon:'rgba(245,158,11,0.12)'  },
  chart_area:           { name:'Top 5 Áreas (Equipos)',  icon:'fa-chart-bar',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'bar',      defColor:'#10b981' },
  chart_asign:          { name:'Asignaciones Activas',   icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'doughnut', defColor:'#2563eb' },
  chart_impresoras:     { name:'Top Marcas Impresión',   icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'doughnut', defColor:'#0ea5e9' },
  chart_licarea:        { name:'Licencias por Área',     icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'inv_ver',        chartType:'pie',      defColor:'#6366f1' },
  chart_software:       { name:'Distribución Software',  icon:'fa-chart-bar',              type:'chart', colSpan:12, rowSpan:2, req:'inv_ver',        chartType:'bar',      defColor:'#2563eb' },
  kpi_tickets_abiertos: { name:'Tickets Abiertos',       icon:'fa-triangle-exclamation',   type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#ef4444', bgIcon:'rgba(239,68,68,0.11)'   },
  kpi_tickets_proceso:  { name:'En Proceso',             icon:'fa-spinner',                type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#f59e0b', bgIcon:'rgba(245,158,11,0.12)'   },
  kpi_tickets_hoy:      { name:'Creados Hoy',            icon:'fa-calendar-plus',          type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#10b981', bgIcon:'rgba(16,185,129,0.11)'  },
  kpi_satisfaccion:     { name:'Satisfacción',           icon:'fa-star',                   type:'kpi',   colSpan:3,  rowSpan:1, req:'tk_ver_global',  defColor:'#f59e0b', bgIcon:'rgba(245,158,11,0.12)'   },
  chart_tickets:        { name:'Estado de Tickets',      icon:'fa-chart-pie',              type:'chart', colSpan:6,  rowSpan:2, req:'tk_ver_global',  chartType:'doughnut', defColor:'#10b981' },
  chart_tickets_area:   { name:'Tickets por Área',       icon:'fa-chart-bar',              type:'chart', colSpan:6,  rowSpan:2, req:'tk_ver_global',  chartType:'bar',      defColor:'#2563eb' },
  kpi_sla_cumplimiento: { name:'Cumplimiento SLA',       icon:'fa-check-circle',           type:'kpi',   colSpan:3,  rowSpan:1, req:'conf_basica',    defColor:'#10b981', bgIcon:'rgba(16,185,129,0.11)'   },
  kpi_sla_vencidos:     { name:'SLA Vencidos',           icon:'fa-clock',                  type:'kpi',   colSpan:3,  rowSpan:1, req:'conf_basica',    defColor:'#ef4444', bgIcon:'rgba(239,68,68,0.11)'   },
  kpi_sla_pendientes:   { name:'SLA Pendientes',         icon:'fa-hourglass-half',         type:'kpi',   colSpan:3,  rowSpan:1, req:'conf_basica',    defColor:'#f59e0b', bgIcon:'rgba(245,158,11,0.12)'   },
  chart_sla_prioridad:  { name:'SLA por Prioridad',      icon:'fa-chart-bar',              type:'chart', colSpan:6,  rowSpan:2, req:'conf_basica',    chartType:'bar',      defColor:'#0ea5e9' },
  list_sla_proximos:    { name:'SLA Próximos a Vencer',  icon:'fa-clock',                  type:'list',  colSpan:6,  rowSpan:2, req:'conf_basica',    defColor:'#f59e0b' },
  list_auditoria:       { name:'Actividad Reciente',     icon:'fa-clipboard-list',         type:'list',  colSpan:12, rowSpan:2, req:'rep_generar',    defColor:'#2563eb' },
  widget_texto:         { name:'Nota / Texto',           icon:'fa-font',                   type:'texto', colSpan:6,  rowSpan:1, req:'any',            defColor:'#6366f1' },
};

const CHART_COLORS_PIE = ['#10b981', '#2563eb', '#0ea5e9', '#f59e0b', '#6366f1', '#ef4444'];

// ─── PERMISOS ─────────────────────────────────────────────────────────────────
function hasPermission(req, permisos) {
  if (req === 'any') return true;
  if (req === 'tk_ver_global') return !!(permisos.tk_ver_global || permisos.tk_responder);
  if (req === 'rep_generar')   return !!(permisos.rep_generar || permisos.conf_basica || permisos.usr_ver);
  return !!permisos[req];
}

// ─── EMPAQUETADOR 2D DE GRILLA (ESTILO CENTRO DE CONTROL ANDROID) ─────────────
// Ubica cada widget en orden dentro de la primera celda libre donde quepa su bloque
// colSpan × rowSpan, eliminando huecos vacíos y colisiones.
function packWidgets(widgets) {
  const occupied = {};

  const isFree = (colStart, rowStart, colSpan, rowSpan) => {
    if (colStart < 1 || colStart + colSpan - 1 > 12) return false;
    for (let r = rowStart; r < rowStart + rowSpan; r++) {
      for (let c = colStart; c < colStart + colSpan; c++) {
        if (occupied[r]?.[c]) return false;
      }
    }
    return true;
  };

  const markOccupied = (colStart, rowStart, colSpan, rowSpan) => {
    for (let r = rowStart; r < rowStart + rowSpan; r++) {
      if (!occupied[r]) occupied[r] = {};
      for (let c = colStart; c < colStart + colSpan; c++) {
        occupied[r][c] = true;
      }
    }
  };

  return widgets.map((w, idx) => {
    const cat = WIDGET_CATALOG[w.type];
    const colSpan = Math.max(1, Math.min(12, parseInt(w.colSpan, 10) || cat?.colSpan || 3));
    const rowSpan = Math.max(1, Math.min(4, parseInt(w.rowSpan, 10) || cat?.rowSpan || 1));

    let placedCol = 1;
    let placedRow = 1;
    let found = false;

    for (let r = 1; r <= 200 && !found; r++) {
      for (let c = 1; c <= 13 - colSpan; c++) {
        if (isFree(c, r, colSpan, rowSpan)) {
          placedCol = c;
          placedRow = r;
          found = true;
          break;
        }
      }
    }

    markOccupied(placedCol, placedRow, colSpan, rowSpan);

    return {
      ...w,
      colStart: placedCol,
      rowStart: placedRow,
      colSpan,
      rowSpan,
      order: idx,
    };
  });
}

// ─── CONFIG POR DEFECTO ───────────────────────────────────────────────────────
function buildDefaultConfig(permisos) {
  const widgets = [];
  let order = 0;
  const ts = Date.now();

  if (hasPermission('inv_ver', permisos)) {
    widgets.push({ id:`w_${ts}_1`, type:'kpi_pcs',        colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_2`, type:'kpi_portatiles',  colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_3`, type:'kpi_impresoras',  colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_4`, type:'kpi_licencias',   colSpan:3,  rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_5`, type:'chart_area',      colSpan:6,  rowSpan:2, order:order++ });
    widgets.push({ id:`w_${ts}_6`, type:'chart_asign',     colSpan:6,  rowSpan:2, order:order++ });
  }
  if (hasPermission('tk_ver_global', permisos)) {
    widgets.push({ id:`w_${ts}_7`,  type:'kpi_tickets_abiertos', colSpan:3, rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_8`,  type:'kpi_tickets_proceso',  colSpan:3, rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_9`,  type:'kpi_tickets_hoy',      colSpan:3, rowSpan:1, order:order++ });
    widgets.push({ id:`w_${ts}_10`, type:'kpi_satisfaccion',     colSpan:3, rowSpan:1, order:order++ });
  }
  if (hasPermission('rep_generar', permisos)) {
    widgets.push({ id:`w_${ts}_11`, type:'list_auditoria', colSpan:12, rowSpan:2, order:order++ });
  }
  return { version:1, widgets: packWidgets(widgets) };
}

// ─── GRID CELL DESDE EVENTO ───────────────────────────────────────────────────
function getGridCellFromEvent(e, canvas) {
  const rect  = canvas.getBoundingClientRect();
  const style = window.getComputedStyle(canvas);
  const gap   = parseInt(style.gap, 10) || 16;
  const pad   = canvas.classList.contains('edit-mode') ? 16 : 0;
  const innerWidth = Math.max(240, rect.width - pad * 2);
  const colWidth   = (innerWidth + gap) / 12;
  const rowHeight  = 125 + gap;
  const x = e.clientX - rect.left - pad;
  const y = e.clientY - rect.top  - pad;
  return {
    col: Math.max(1, Math.min(12, Math.floor(x / colWidth) + 1)),
    row: Math.max(1, Math.floor(y / rowHeight) + 1)
  };
}

// ─── WIDGET CHART ADAPTATIVO AL TEMA (INVESTER STYLE) ─────────────────────────
function WidgetChart({ chartType, rowSpan, data, accentColor, isDark }) {
  const cType  = chartType || 'bar';
  const isPie  = cType === 'pie' || cType === 'doughnut';
  const isLine = cType === 'line';
  const height = Math.max(110, (rowSpan || 2) * 105);
  const primaryHex = accentColor || '#10b981';

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.06)';
  const pieBorderColor = isDark ? '#111827' : '#ffffff';

  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      data: data?.values || [],
      backgroundColor: isPie
        ? CHART_COLORS_PIE
        : isLine
        ? `${primaryHex}22`
        : primaryHex,
      borderColor: isPie ? pieBorderColor : primaryHex,
      borderWidth: isPie ? 2 : 2.5,
      borderRadius: cType === 'bar' ? 6 : 0,
      fill: isLine,
      tension: isLine ? 0.36 : 0,
      pointBackgroundColor: primaryHex,
      pointBorderColor: pieBorderColor,
      pointBorderWidth: 2,
      pointRadius: isLine ? 3 : 0,
      pointHoverRadius: isLine ? 5 : 0,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    cutout: cType === 'doughnut' ? '66%' : undefined,
    plugins: {
      legend: {
        display: isPie,
        position: 'right',
        labels: {
          color: textColor,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
          font: { family: "'DM Sans', sans-serif", size: 12, weight: '500' },
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#f8fafc',
        borderColor: isDark ? '#334155' : '#1e293b',
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        titleFont: { family: "'DM Sans', sans-serif", size: 12, weight: '600' },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 12, weight: '600' },
      },
    },
    ...(cType === 'bar' || cType === 'line' ? {
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "'DM Sans', sans-serif", size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 11 } },
          grid: { color: gridColor },
          border: { display: false },
        },
      },
    } : {}),
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
  const { permisos, esAdministrativo } = useAuth();

  const [config, setConfig]       = useState({ version:1, widgets:[] });
  const [dashData, setDashData]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [lastSaved, setLastSaved] = useState('No guardado');
  const [isDark, setIsDark]       = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  const [isEditMode, setIsEditMode]   = useState(false);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [panelTab, setPanelTab]       = useState('catalog');
  const [selectedId, setSelectedId]   = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('');

  const [draggedId, setDraggedId]         = useState(null);
  const [swapTargetId, setSwapTargetId]   = useState(null);
  const [placeholder, setPlaceholder]     = useState(null);

  const canvasRef             = useRef(null);
  const configRef             = useRef(config);
  const saveTimer             = useRef(null);
  const draggedCatalogTypeRef = useRef(null);
  const lastSwappedTargetRef  = useRef(null);
  const didLiveSwapRef        = useRef(false);

  configRef.current = config;

  const selectedWidget = config.widgets.find(w => w.id === selectedId) || null;

  useEffect(() => {
    const syncTheme = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    window.addEventListener('themechange', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('themechange', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

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
          const validWidgets = [...saved.widgets]
            .filter(w => WIDGET_CATALOG[w.type] && hasPermission(WIDGET_CATALOG[w.type].req, permisos))
            .sort((a, b) => {
              if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
                return a.order - b.order;
              }
              if ((a.rowStart || 1) !== (b.rowStart || 1)) return (a.rowStart || 1) - (b.rowStart || 1);
              return (a.colStart || 1) - (b.colStart || 1);
            });
          setConfig({ version: saved.version || 1, widgets: packWidgets(validWidgets) });
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

  // ── Guardado con debounce ───────────────────────────────────────────────────
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
    }, 800);
  }, []);

  const updateConfig = useCallback((newWidgets, _anchorId = null, message = null) => {
    const packed = packWidgets(newWidgets);
    const newCfg = { ...configRef.current, widgets: packed };
    setConfig(newCfg);
    queueSave(newCfg, message);
    return packed;
  }, [queueSave]);

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
        setSwapTargetId(null);
        setPlaceholder(null);
        queueSave(configRef.current, 'Configuración del dashboard guardada');
      }
      return next;
    });
  }, [queueSave]);

  // ── Añadir widget (al final o en el índice indicado) ────────────────────────
  const addWidget = useCallback((typeId, insertAtIndex = null) => {
    const cat = WIDGET_CATALOG[typeId];
    if (!cat) return;
    const widgets = [...configRef.current.widgets];

    const newW = {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: typeId,
      colSpan: cat.colSpan,
      rowSpan: cat.rowSpan,
      order: widgets.length,
      config: {}
    };

    if (insertAtIndex !== null && insertAtIndex >= 0 && insertAtIndex <= widgets.length) {
      widgets.splice(insertAtIndex, 0, newW);
    } else {
      widgets.push(newW);
    }

    updateConfig(widgets, newW.id, `Widget "${cat.name}" añadido`);
    setSelectedId(newW.id);
  }, [updateConfig]);

  // ── Intercambiar dos widgets de lugar (Estilo Centro de Control Android) ───
  const swapWidgetsById = useCallback((idA, idB, persist = true) => {
    if (!idA || !idB || idA === idB) return;
    const current = [...configRef.current.widgets];
    const idxA = current.findIndex(w => w.id === idA);
    const idxB = current.findIndex(w => w.id === idB);
    if (idxA === -1 || idxB === -1) return;

    const temp = current[idxA];
    current[idxA] = current[idxB];
    current[idxB] = temp;

    const packed = packWidgets(current);
    const newCfg = { ...configRef.current, widgets: packed };
    setConfig(newCfg);
    if (persist) {
      queueSave(newCfg);
    }
  }, [queueSave]);

  // ── Mover widget un lugar antes o después (Botones ← / →) ──────────────────
  const moveWidgetStep = useCallback((widgetId, delta) => {
    const current = [...configRef.current.widgets];
    const idx = current.findIndex(w => w.id === widgetId);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= current.length) return;

    const temp = current[idx];
    current[idx] = current[targetIdx];
    current[targetIdx] = temp;

    updateConfig(current, widgetId);
  }, [updateConfig]);

  // ── Eliminar widget ─────────────────────────────────────────────────────────
  const deleteWidget = useCallback((id) => {
    showConfirm({
      title: '¿Eliminar widget?',
      text: 'Desaparecerá del dashboard y los demás elementos ocuparán su espacio.',
      icon: 'warning',
      confirmVariant: 'danger',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }, () => {
      const newWidgets = configRef.current.widgets.filter(w => w.id !== id);
      updateConfig(newWidgets, null, 'Widget eliminado del dashboard');
      if (selectedId === id) { setSelectedId(null); setPanelTab('catalog'); }
    });
  }, [updateConfig, selectedId]);

  // ── Aplicar edición de widget ───────────────────────────────────────────────
  const applyEdit = useCallback((id, changes) => {
    const newWidgets = configRef.current.widgets.map(w => {
      if (w.id !== id) return w;
      const merged = { ...w };
      if (changes.colSpan !== undefined) merged.colSpan = Math.max(1, Math.min(12, changes.colSpan));
      if (changes.rowSpan !== undefined) merged.rowSpan = Math.max(1, Math.min(4, changes.rowSpan));
      if (changes.config) {
        merged.config = { ...(w.config || {}), ...changes.config };
      }
      return merged;
    });
    updateConfig(newWidgets, id);
  }, [updateConfig]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetToDefault = useCallback(() => {
    showConfirm({
      title: '¿Restablecer dashboard?',
      text: 'Se perderá toda tu configuración actual y volverá al diseño por defecto.',
      icon: 'warning',
      confirmButtonText: 'Sí, restablecer',
      cancelButtonText: 'Cancelar',
    }, () => {
      const def = buildDefaultConfig(permisos);
      setConfig(def);
      queueSave(def, 'Dashboard restablecido a configuración por defecto');
      setPanelOpen(false);
    });
  }, [permisos, queueSave]);

  // ── Drag & Swap entre Widgets (Estilo Centro de Control Android) ───────────
  const handleDragStart = useCallback((e, widgetId) => {
    if (!isEditMode) { e.preventDefault(); return; }
    setDraggedId(widgetId);
    setSwapTargetId(null);
    lastSwappedTargetRef.current = null;
    didLiveSwapRef.current = false;
    draggedCatalogTypeRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
  }, [isEditMode]);

  const handleDragEnd = useCallback(() => {
    if (didLiveSwapRef.current) {
      queueSave(configRef.current);
    }
    setDraggedId(null);
    setSwapTargetId(null);
    setPlaceholder(null);
    lastSwappedTargetRef.current = null;
    didLiveSwapRef.current = false;
    draggedCatalogTypeRef.current = null;
  }, [queueSave]);

  // Cuando se arrastra un widget sobre otro widget -> intercambian lugares en vivo
  const handleWidgetDragOver = useCallback((e, targetWidgetId) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    const margin = 120, speed = 18;
    if (e.clientY < margin) window.scrollBy(0, -speed);
    else if (window.innerHeight - e.clientY < margin) window.scrollBy(0, speed);

    // Si estamos arrastrando un widget existente del dashboard
    if (draggedId) {
      e.dataTransfer.dropEffect = 'move';
      if (draggedId === targetWidgetId) {
        // El cursor ya está dentro de la nueva posición del widget arrastrado
        lastSwappedTargetRef.current = null;
        setSwapTargetId(null);
        return;
      }

      // Evitar oscilación inmediata con el mismo widget tras el intercambio
      if (lastSwappedTargetRef.current === targetWidgetId) {
        return;
      }

      lastSwappedTargetRef.current = targetWidgetId;
      didLiveSwapRef.current = true;
      setSwapTargetId(targetWidgetId);
      swapWidgetsById(draggedId, targetWidgetId, false);
      return;
    }

    // Si estamos arrastrando un widget nuevo desde el catálogo
    if (draggedCatalogTypeRef.current || e.dataTransfer.types.includes('application/catalog-id')) {
      e.dataTransfer.dropEffect = 'copy';
      setSwapTargetId(targetWidgetId);
      setPlaceholder(null);
    }
  }, [isEditMode, draggedId, swapWidgetsById]);

  const handleWidgetDrop = useCallback((e, targetWidgetId) => {
    e.preventDefault();
    e.stopPropagation();
    setSwapTargetId(null);
    setPlaceholder(null);

    if (!isEditMode) return;

    // Si se suelta un ítem desde el catálogo sobre este widget -> se inserta en su lugar
    const catType = draggedCatalogTypeRef.current || e.dataTransfer.getData('application/catalog-id');
    if (!draggedId && catType && WIDGET_CATALOG[catType]) {
      const targetIdx = configRef.current.widgets.findIndex(w => w.id === targetWidgetId);
      addWidget(catType, targetIdx !== -1 ? targetIdx : null);
      draggedCatalogTypeRef.current = null;
      return;
    }

    // Si se arrastró un widget existente, guardar orden resultante
    if (draggedId) {
      if (!didLiveSwapRef.current && draggedId !== targetWidgetId) {
        swapWidgetsById(draggedId, targetWidgetId, true);
      } else {
        queueSave(configRef.current);
      }
      setDraggedId(null);
      lastSwappedTargetRef.current = null;
      didLiveSwapRef.current = false;
    }
  }, [isEditMode, draggedId, addWidget, swapWidgetsById, queueSave]);

  // ── Dragover / Drop en espacios libres del canvas ──────────────────────────
  const handleCanvasDragOver = useCallback((e) => {
    if (!isEditMode) return;
    e.preventDefault();
    const isCatalog = !!(draggedCatalogTypeRef.current || e.dataTransfer.types.includes('application/catalog-id'));
    e.dataTransfer.dropEffect = draggedId ? 'move' : 'copy';

    const margin = 120, speed = 18;
    if (e.clientY < margin) window.scrollBy(0, -speed);
    else if (window.innerHeight - e.clientY < margin) window.scrollBy(0, speed);

    if (!canvasRef.current) return;

    if (isCatalog) {
      const cat = WIDGET_CATALOG[draggedCatalogTypeRef.current];
      const colSpan = cat?.colSpan || 3;
      const rowSpan = cat?.rowSpan || 1;
      const cell = getGridCellFromEvent(e, canvasRef.current);
      const safeCol = Math.min(cell.col, 13 - colSpan);
      setPlaceholder(prev => {
        if (prev?.col === safeCol && prev?.row === cell.row) return prev;
        return { col: safeCol, row: cell.row, colSpan, rowSpan };
      });
    }
  }, [isEditMode, draggedId]);

  const handleCanvasDragLeave = useCallback((e) => {
    if (e.relatedTarget && canvasRef.current?.contains(e.relatedTarget)) return;
    setPlaceholder(null);
    setSwapTargetId(null);
  }, []);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    setPlaceholder(null);
    setSwapTargetId(null);
    if (!isEditMode || !canvasRef.current) return;

    const cell = getGridCellFromEvent(e, canvasRef.current);

    if (draggedId) {
      // Si no se intercambió en vivo, buscamos el widget más cercano a la celda donde se soltó
      if (!didLiveSwapRef.current) {
        const current = [...configRef.current.widgets];
        const draggedIdx = current.findIndex(w => w.id === draggedId);
        if (draggedIdx !== -1) {
          let closestId = null;
          let minDist = Infinity;
          current.forEach(w => {
            if (w.id === draggedId) return;
            const centerCol = (w.colStart || 1) + (w.colSpan || 3) / 2;
            const centerRow = (w.rowStart || 1) + (w.rowSpan || 1) / 2;
            const dist = Math.hypot(cell.col - centerCol, (cell.row - centerRow) * 2);
            if (dist < minDist) {
              minDist = dist;
              closestId = w.id;
            }
          });
          if (closestId) {
            swapWidgetsById(draggedId, closestId, true);
          }
        }
      } else {
        queueSave(configRef.current);
      }
      setDraggedId(null);
      lastSwappedTargetRef.current = null;
      didLiveSwapRef.current = false;
      return;
    }

    const typeId = draggedCatalogTypeRef.current || e.dataTransfer.getData('application/catalog-id');
    if (typeId && WIDGET_CATALOG[typeId]) {
      addWidget(typeId);
      draggedCatalogTypeRef.current = null;
    }
  }, [isEditMode, draggedId, swapWidgetsById, queueSave, addWidget]);

  // ── Catalog drag start ──────────────────────────────────────────────────────
  const handleCatalogDragStart = useCallback((e, typeId) => {
    draggedCatalogTypeRef.current = typeId;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/catalog-id', typeId);
    e.dataTransfer.setData('text/plain', 'CATALOG:' + typeId);
  }, []);

  // ── Resize con re-empaquetado automático en vivo ────────────────────────────
  const handleResizeMouseDown = useCallback((e, widgetId) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    const wObj = configRef.current.widgets.find(w => w.id === widgetId);
    if (!wObj) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startColSpan = wObj.colSpan;
    const startRowSpan = wObj.rowSpan;
    let lastColSpan = startColSpan;
    let lastRowSpan = startRowSpan;

    const onMouseMove = (ev) => {
      if (!canvasRef.current) return;
      const style     = window.getComputedStyle(canvasRef.current);
      const gap       = parseInt(style.gap, 10) || 16;
      const colWidth  = (canvasRef.current.offsetWidth + gap) / 12;
      const rowHeight = 125 + gap;

      const colDelta = Math.round((ev.clientX - startX) / colWidth);
      const rowDelta = Math.round((ev.clientY - startY) / rowHeight);

      const newColSpan = Math.max(2, Math.min(12, startColSpan + colDelta));
      const newRowSpan = Math.max(1, Math.min(4, startRowSpan + rowDelta));

      if (newColSpan === lastColSpan && newRowSpan === lastRowSpan) return;
      lastColSpan = newColSpan;
      lastRowSpan = newRowSpan;

      setConfig(prev => {
        const updated = prev.widgets.map(w =>
          w.id === widgetId ? { ...w, colSpan: newColSpan, rowSpan: newRowSpan } : w
        );
        return { ...prev, widgets: packWidgets(updated) };
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      queueSave(configRef.current);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isEditMode, queueSave]);

  // ── Datos para cada widget ──────────────────────────────────────────────────
  const getKpiData = useCallback((type) => {
    let val = 0, sub = '', pct = 0, badge = null;
    if (dashData?.inventory) {
      const inv = dashData.inventory;
      const totEq = inv.totalEquipos || 1;
      if (type==='kpi_pcs')        { val=inv.totalPCs;        sub='Total equipos'; pct=(val/totEq)*100; badge=`${Math.round(pct)}%`; }
      if (type==='kpi_portatiles') { val=inv.totalPortatiles; sub='Total equipos'; pct=(val/totEq)*100; badge=`${Math.round(pct)}%`; }
      if (type==='kpi_impresoras') { val=inv.totalImpresoras; sub='Total equipos'; pct=(val/totEq)*100; badge=`${Math.round(pct)}%`; }
      if (type==='kpi_licencias')  {
        val=inv.totalLicencias;
        sub=`${inv.licenciasLibres} Libres`;
        pct=inv.totalLicencias>0?((inv.totalLicencias-inv.licenciasLibres)/inv.totalLicencias)*100:0;
        badge=`${Math.round(pct)}% uso`;
      }
    }
    if (dashData?.support) {
      const sup = dashData.support;
      if (type==='kpi_tickets_abiertos') { val=sup.ticketsAbiertos;      sub='Pendientes';  pct=100; badge='Activos'; }
      if (type==='kpi_tickets_proceso')  { val=sup.ticketsProceso;       sub='En revisión'; pct=100; badge='Curso'; }
      if (type==='kpi_tickets_hoy')      { val=sup.ticketsHoy;           sub='Hoy';         pct=100; badge='24h'; }
      if (type==='kpi_satisfaccion')     { val=sup.promedioSatisfaccion; sub='Sobre 5.0';   pct=(val/5)*100; badge=`${Math.round(pct)}%`; }
    }
    if (dashData?.sla) {
      const sla = dashData.sla;
      if (type==='kpi_sla_cumplimiento') { val=sla.porcentaje_cumplimiento; sub='% Cumplimiento'; pct=val; badge='SLA'; }
      if (type==='kpi_sla_vencidos')     { val=sla.incumplidos_resolucion;  sub='Vencidos';       pct=100; badge='Crítico'; }
      if (type==='kpi_sla_pendientes')   { val=sla.pendientes;              sub='Pendientes';     pct=100; badge='En plazo'; }
    }
    return { val, sub, pct: Math.min(Math.max(pct, 0), 100), badge };
  }, [dashData]);

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
      const { val, sub, pct, badge } = getKpiData(w.type);
      const color = conf.color || cat.defColor || 'var(--primary-color)';
      return (
        <>
          <div className="kpi-row">
            <div>
              <div className="kpi-value-big">{val ?? 0}</div>
              <div className="kpi-sub">
                <span>{sub || cat.name}</span>
                {badge && (
                  <span
                    className="ui-pill"
                    style={{
                      padding: '2px 8px',
                      fontSize: '10.5px',
                      background: `${color}18`,
                      color,
                      borderColor: `${color}35`,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
            </div>
            <div
              className="kpi-icon-box"
              style={{
                background: cat.bgIcon || `${color}15`,
                color,
                borderColor: `${color}30`,
              }}
            >
              <i className={`fa-solid ${conf.icon || cat.icon}`}></i>
            </div>
          </div>
          <div className="w-progress-bg">
            <div className="w-progress-fill" style={{ width: `${pct}%`, background: color }}></div>
          </div>
        </>
      );
    }

    if (cat.type === 'chart') {
      return null;
    }

    if (cat.type === 'list' && w.type === 'list_auditoria') {
      const audit = dashData?.audit || [];
      const iconMap = {
        usuarios: 'fa-user',
        equipos_de_computo: 'fa-computer',
        licencias: 'fa-key',
        tickets: 'fa-ticket',
      };
      return (
        <ul className="w-activity-list">
          {audit.length === 0 ? (
            <li style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', justifyContent: 'center' }}>
              Sin actividad reciente
            </li>
          ) : (
            audit.map((a, i) => {
              const tabla = (a.tabla || '').replace(/_/g, ' ');
              const icon  = iconMap[a.tabla] || 'fa-file-pen';
              const f     = a.fecha ? new Date(a.fecha.replace(' ', 'T')) : null;
              const fStr  = f ? `${f.getDate()} ${f.toLocaleString('es', { month: 'short' })} • ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}` : '';
              let desc = a.descripcion || '';
              if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/i.test(desc)) desc = 'Acción del sistema';
              if (desc.length > 85) desc = desc.substring(0, 85) + '…';
              return (
                <li key={i}>
                  <div className="w-activity-icon">
                    <i className={`fa-solid ${icon}`}></i>
                  </div>
                  <div className="w-activity-content">
                    <div className="w-activity-title">{desc}</div>
                    <div className="w-activity-meta" style={{ textTransform: 'capitalize' }}>{tabla}</div>
                  </div>
                  {fStr && (
                    <span className="ui-pill pill-slate" style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
                      {fStr}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      );
    }

    if (cat.type === 'list' && w.type === 'list_sla_proximos') {
      const slaList = dashData?.sla?.proximos_a_vencer || [];
      const getPriorityPill = (prio) => {
        const p = (prio || '').toLowerCase();
        if (p.includes('crít') || p.includes('crit')) return 'pill-rose';
        if (p.includes('alta')) return 'pill-amber';
        if (p.includes('media')) return 'pill-cyan';
        return 'pill-emerald';
      };
      return (
        <ul className="w-activity-list">
          {slaList.length === 0 ? (
            <li style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', justifyContent: 'center' }}>
              No hay SLAs próximos a vencer
            </li>
          ) : (
            slaList.map((sla, i) => {
              const f = new Date(sla.fecha_limite_resolucion.replace(' ', 'T'));
              const fStr = `${f.getDate()} ${f.toLocaleString('es', { month: 'short' })} • ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
              return (
                <li key={i}>
                  <div className="w-activity-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)' }}>
                    <i className="fa-solid fa-clock"></i>
                  </div>
                  <div className="w-activity-content">
                    <div className="w-activity-title">Ticket #{sla.id} — {sla.titulo}</div>
                    <div className="w-activity-meta">Vence: {fStr}</div>
                  </div>
                  <span className={`ui-pill ${getPriorityPill(sla.prioridad)}`}>
                    {sla.prioridad}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      );
    }

    if (cat.type === 'texto') {
      return <div className="w-text-content">{conf.content || 'Sin contenido. Edita el widget para añadir texto.'}</div>;
    }

    return null;
  }, [getKpiData, dashData]);

  // ── Panel editor de widget ──────────────────────────────────────────────────
  const renderEditor = useCallback(() => {
    if (!selectedWidget) {
      return (
        <div className="editor-no-selection">
          <i className="fa-solid fa-hand-pointer"></i>
          <p>Haz clic sobre cualquier widget del dashboard o en su ícono <i className="fa-solid fa-gear"></i> para modificarlo.</p>
        </div>
      );
    }
    const cat  = WIDGET_CATALOG[selectedWidget.type];
    const conf = selectedWidget.config || {};
    const title    = conf.title    || cat?.name || '';
    const color    = conf.color    || cat?.defColor || '#2563eb';
    const colSpan  = selectedWidget.colSpan;
    const rowSpan  = selectedWidget.rowSpan;
    const cType    = conf.chartType || cat?.chartType || 'bar';
    const idx      = config.widgets.findIndex(w => w.id === selectedWidget.id);

    const sizePresets = [
      { label: 'Compacto',   desc: '3 × 1 celdas', col: 3,  row: 1 },
      { label: 'Mediano',    desc: '4 × 1 celdas', col: 4,  row: 1 },
      { label: 'Mitad',      desc: '6 × 2 celdas', col: 6,  row: 2 },
      { label: 'Panorámico', desc: '12 × 2 celdas', col: 12, row: 2 },
    ];

    return (
      <div className="editor-form" key={selectedWidget.id}>
        <div className="editor-section-title">Modificando: {cat?.name}</div>

        <div className="form-group">
          <label>Título visible</label>
          <input
            type="text"
            className="form-control"
            defaultValue={title}
            onBlur={(e) => applyEdit(selectedWidget.id, { config: { title: e.target.value } })}
          />
        </div>

        <div className="form-group">
          <label>Color de acento</label>
          <div className="color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => applyEdit(selectedWidget.id, { config: { color: e.target.value } })}
            />
            <span className="color-preview">{color}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Tamaño rápido (Estilo mosaico)</label>
          <div className="editor-preset-grid">
            {sizePresets.map(preset => {
              const isActive = colSpan === preset.col && rowSpan === preset.row;
              return (
                <button
                  key={`${preset.col}x${preset.row}`}
                  type="button"
                  className={`editor-preset-btn ${isActive ? 'active' : ''}`}
                  onClick={() => applyEdit(selectedWidget.id, { colSpan: preset.col, rowSpan: preset.row })}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label>Ancho personalizado (Columnas 2-12)</label>
          <div className="range-wrap">
            <input
              type="range"
              min="2"
              max="12"
              value={colSpan}
              onChange={(e) => applyEdit(selectedWidget.id, { colSpan: parseInt(e.target.value, 10) })}
            />
            <span className="range-val">{colSpan}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Altura personalizada (Filas 1-4)</label>
          <div className="range-wrap">
            <input
              type="range"
              min="1"
              max="4"
              value={rowSpan}
              onChange={(e) => applyEdit(selectedWidget.id, { rowSpan: parseInt(e.target.value, 10) })}
            />
            <span className="range-val">{rowSpan}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Reubicar orden en la cuadrícula</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              disabled={idx <= 0}
              onClick={() => moveWidgetStep(selectedWidget.id, -1)}
            >
              <i className="fa-solid fa-arrow-left"></i> Mover antes
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              disabled={idx === -1 || idx >= config.widgets.length - 1}
              onClick={() => moveWidgetStep(selectedWidget.id, 1)}
            >
              Mover después <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>

        {cat?.type === 'chart' && (
          <div className="form-group">
            <label>Tipo de Gráfica</label>
            <select
              className="form-control"
              value={cType}
              onChange={(e) => applyEdit(selectedWidget.id, { config: { chartType: e.target.value } })}
            >
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
            <textarea
              className="form-control"
              rows="4"
              defaultValue={conf.content || ''}
              onBlur={(e) => applyEdit(selectedWidget.id, { config: { content: e.target.value } })}
            />
          </div>
        )}

        <div className="editor-actions">
          <button
            type="button"
            className="dash-btn dash-btn-danger"
            style={{ width: '100%' }}
            onClick={() => deleteWidget(selectedWidget.id)}
          >
            <i className="fa-solid fa-trash"></i> Eliminar Widget
          </button>
        </div>
      </div>
    );
  }, [selectedWidget, config.widgets, applyEdit, moveWidgetStep, deleteWidget]);

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

  const orderedWidgets = [...config.widgets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <>
      {/* Cabecera de Página (Sin botón de edición duplicado; solo se usa el botón flotante del lápiz) */}
      <div className="inventory-header" style={{ marginBottom: '20px' }}>
        <div className="page-title-row">
          <div>
            <h2>
              <i className="fa-solid fa-chart-line"></i>
              Consola Operativa TI
            </h2>
            <p className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
              Indicadores clave de inventario, soporte técnico y cumplimiento SLA en tiempo real
            </p>
          </div>
        </div>
      </div>

      {/* Barra de edición */}
      <div id="dashboard-edit-bar" className={`${isEditMode ? 'visible' : ''} ${panelOpen ? 'panel-open' : ''}`}>
        <div className="bar-title">
          <i className="fa-solid fa-pen-ruler"></i>
          <span>Modo Edición Activo</span>
          <span
            className="ui-pill pill-slate"
            style={{ textTransform: 'none', fontWeight: 500, fontSize: '11.5px', marginLeft: '6px' }}
          >
            Arrastra un elemento sobre otro para intercambiar lugares
          </span>
        </div>
        <button
          type="button"
          className="dash-btn dash-btn-secondary"
          onClick={() => {
            setPanelOpen(true);
            setPanelTab(selectedId ? 'edit' : 'catalog');
          }}
        >
          <i className="fa-solid fa-sliders"></i> Añadir / Modificar
        </button>
        <button type="button" className="dash-btn dash-btn-primary" onClick={toggleEditMode}>
          <i className="fa-solid fa-floppy-disk"></i> Guardar Cambios
        </button>
      </div>

      {/* Canvas */}
      <div
        id="dashboard-canvas"
        ref={canvasRef}
        className={`${isEditMode ? 'edit-mode' : ''} ${panelOpen ? 'panel-open' : ''}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
      >
        {orderedWidgets.length === 0 ? (
          <div className="dash-empty-msg" style={{ display:'block', gridColumn:'1 / -1' }}>
            <i className="fa-solid fa-puzzle-piece"></i>
            <p>
              El dashboard está vacío.<br />
              Haz clic en el botón del lápiz <i className="fa-solid fa-pen" style={{ fontSize: '13px', margin: 0 }}></i> y luego en <strong>"Añadir / Modificar"</strong> para agregar elementos.
            </p>
          </div>
        ) : (
          orderedWidgets.map((w, idx) => {
            const cat = WIDGET_CATALOG[w.type];
            if (!cat) return null;
            if (!hasPermission(cat.req, permisos)) return null;
            const conf  = w.config || {};
            const title = conf.title || cat.name;
            const icon  = conf.icon  || cat.icon;
            const color = conf.color || cat.defColor || '#2563eb';
            const isDragging   = draggedId === w.id;
            const isSwapTarget = swapTargetId === w.id && draggedId !== w.id;

            return (
              <div
                key={w.id}
                id={`widget-${w.id}`}
                className={`dash-widget wtype-${cat.type}${isEditMode ? ' edit-mode' : ''}${isDragging ? ' is-dragging' : ''}${isSwapTarget ? ' is-swap-target' : ''}${isEditMode && selectedId === w.id ? ' is-selected' : ''}`}
                draggable={isEditMode}
                style={{
                  '--w-col-start': w.colStart || 'auto',
                  '--w-row-start': w.rowStart || 'auto',
                  '--w-col': w.colSpan,
                  '--w-row': w.rowSpan,
                }}
                onDragStart={(e) => handleDragStart(e, w.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleWidgetDragOver(e, w.id)}
                onDrop={(e) => handleWidgetDrop(e, w.id)}
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
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        background: `${color}15`,
                        color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      <i className={`fa-solid ${icon}`} style={{ color }}></i>
                    </span>
                    <span>{title}</span>
                  </div>
                  <div className="dash-widget-controls">
                    <button
                      type="button"
                      className="wctrl-btn"
                      title="Intercambiar con el anterior"
                      disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); moveWidgetStep(w.id, -1); }}
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <button
                      type="button"
                      className="wctrl-btn"
                      title="Intercambiar con el siguiente"
                      disabled={idx === orderedWidgets.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveWidgetStep(w.id, 1); }}
                    >
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                    <button
                      type="button"
                      className="wctrl-btn wctrl-edit"
                      title="Modificar widget"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(w.id);
                        setPanelTab('edit');
                        setPanelOpen(true);
                      }}
                    >
                      <i className="fa-solid fa-gear"></i>
                    </button>
                    <button
                      type="button"
                      className="wctrl-btn wctrl-delete"
                      title="Eliminar widget"
                      onClick={(e) => { e.stopPropagation(); deleteWidget(w.id); }}
                    >
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
                      accentColor={color}
                      isDark={isDark}
                    />
                  ) : (
                    renderWidgetBody(w)
                  )}
                </div>

                {/* Resize handle */}
                <div
                  className="dash-widget-resize"
                  title="Arrastra para redimensionar"
                  onMouseDown={(e) => handleResizeMouseDown(e, w.id)}
                >
                  <i
                    className="fa-solid fa-up-right-and-down-left-from-center"
                    style={{ transform: 'rotate(90deg)' }}
                  ></i>
                </div>
              </div>
            );
          })
        )}

        {/* Placeholder de drop desde catálogo */}
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

      {/* Único botón de edición (flotante del lápiz) */}
      <button
        id="btn-toggle-edit"
        type="button"
        className={isEditMode ? 'active' : ''}
        onClick={toggleEditMode}
        title={isEditMode ? 'Guardar y salir del modo edición' : 'Personalizar Dashboard'}
      >
        <i className={`fa-solid ${isEditMode ? 'fa-check' : 'fa-pen'}`}></i>
      </button>

      {/* Panel lateral */}
      <div id="dashboard-panel" className={panelOpen ? 'open' : ''}>
        <div className="panel-header">
          <h3><i className="fa-solid fa-sliders"></i> Añadir / Modificar</h3>
          <button type="button" className="panel-close" onClick={() => setPanelOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="panel-tabs">
          {[
            { key:'catalog',  icon:'fa-plus',    label:'Añadir'    },
            { key:'edit',     icon:'fa-pen',     label:'Modificar' },
            { key:'settings', icon:'fa-sliders', label:'Ajustes'   },
          ].map(tab => (
            <div
              key={tab.key}
              className={`panel-tab ${panelTab === tab.key ? 'active' : ''}`}
              onClick={() => setPanelTab(tab.key)}
            >
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </div>
          ))}
        </div>

        <div className="panel-body">

          {/* ── Catálogo (Añadir) ── */}
          {panelTab === 'catalog' && (
            <div className="panel-view active">
              <div className="catalog-search">
                <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-tertiary)' }}></i>
                <input
                  type="text"
                  placeholder="Buscar widgets para añadir..."
                  value={catalogFilter}
                  onChange={(e) => setCatalogFilter(e.target.value)}
                />
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
                      <div
                        key={item.id}
                        className="catalog-item"
                        draggable
                        onDragStart={(e) => handleCatalogDragStart(e, item.id)}
                      >
                        <div className="catalog-item-icon">
                          <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div className="catalog-item-info">
                          <strong>{item.name}</strong>
                          <span>{item.colSpan}×{item.rowSpan} celdas</span>
                        </div>
                        <button
                          type="button"
                          className="catalog-add-btn"
                          title={`Añadir ${item.name}`}
                          onClick={() => addWidget(item.id)}
                        >
                          <i className="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Editor (Modificar) ── */}
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
                <button
                  type="button"
                  className="dash-btn dash-btn-danger"
                  style={{ width:'100%' }}
                  onClick={resetToDefault}
                >
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
