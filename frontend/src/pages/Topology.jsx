import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { topologyAPI, equipmentAPI, auxAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import dagre from 'dagre';

// ─── ICON REGISTRY (fixed: brands prefix for logos) ───────────────────────────
const ICON_MAP = {
  'fa-docker':    { prefix: 'fab', cls: 'fa-brands fa-docker' },
  'fa-aws':       { prefix: 'fab', cls: 'fa-brands fa-aws' },
  'fa-microsoft': { prefix: 'fab', cls: 'fa-brands fa-microsoft' },
  'fa-google':    { prefix: 'fab', cls: 'fa-brands fa-google' },
};
const resolveIcon = (icon) => ICON_MAP[icon]?.cls || `fa-solid ${icon}`;

// ─── NODE CATEGORIES ───────────────────────────────────────────────────────────
const NODE_CATEGORIES = {
  fisica:        { label: 'Infraestructura Física',    color: '#4a6cf7', icon: 'fa-building' },
  red:           { label: 'Redes y Seguridad',          color: '#10b981', icon: 'fa-shield-halved' },
  computo:       { label: 'Cómputo y Virtualización',  color: '#6366f1', icon: 'fa-server' },
  cloud:         { label: 'Cloud y VPN',                color: '#0ea5e9', icon: 'fa-cloud' },
  logica:        { label: 'Lógica y Servicios',         color: '#f59e0b', icon: 'fa-code' },
  organizacion:  { label: 'Organización',               color: '#ec4899', icon: 'fa-users' },
};

// ─── NODE TYPES CONFIG ─────────────────────────────────────────────────────────
const NODE_TYPES_CONFIG = {
  Empresa:          { label: 'Empresa',            category: 'fisica',       icon: 'fa-building-columns' },
  Sucursal:         { label: 'Sucursal',           category: 'fisica',       icon: 'fa-city' },
  Edificio:         { label: 'Edificio',           category: 'fisica',       icon: 'fa-hotel' },
  Piso:             { label: 'Piso',               category: 'fisica',       icon: 'fa-layer-group' },
  Sala_Tecnica:     { label: 'Sala Técnica',       category: 'fisica',       icon: 'fa-door-closed' },
  Rack:             { label: 'Rack',               category: 'fisica',       icon: 'fa-square' },
  Gabinete:         { label: 'Gabinete',           category: 'fisica',       icon: 'fa-box' },
  Switch:           { label: 'Switch',             category: 'red',          icon: 'fa-network-wired' },
  Router:           { label: 'Router',             category: 'red',          icon: 'fa-route' },
  Firewall:         { label: 'Firewall',           category: 'red',          icon: 'fa-shield-halved' },
  Access_Point:     { label: 'Access Point',       category: 'red',          icon: 'fa-wifi' },
  Gateway:          { label: 'Gateway',            category: 'red',          icon: 'fa-door-open' },
  Balanceador:      { label: 'Balanceador',        category: 'red',          icon: 'fa-scale-balanced' },
  Proxy:            { label: 'Proxy',              category: 'red',          icon: 'fa-shield' },
  Servidor:         { label: 'Servidor Físico',    category: 'computo',      icon: 'fa-server' },
  Servidor_Virtual: { label: 'Servidor Virtual',   category: 'computo',      icon: 'fa-cube' },
  Maquina_Virtual:  { label: 'Máquina Virtual',    category: 'computo',      icon: 'fa-cubes' },
  Docker:           { label: 'Docker Container',   category: 'computo',      icon: 'fa-docker' },
  Kubernetes:       { label: 'Kubernetes',         category: 'computo',      icon: 'fa-cubes-stacked' },
  NAS:              { label: 'NAS',                category: 'computo',      icon: 'fa-hard-drive' },
  SAN:              { label: 'SAN',                category: 'computo',      icon: 'fa-database' },
  UPS:              { label: 'UPS',                category: 'computo',      icon: 'fa-bolt' },
  Patch_Panel:      { label: 'Patch Panel',        category: 'computo',      icon: 'fa-ethernet' },
  PC:               { label: 'PC Escritorio',      category: 'computo',      icon: 'fa-desktop' },
  Laptop:           { label: 'Laptop',             category: 'computo',      icon: 'fa-laptop' },
  PBX:              { label: 'PBX / Telefonía',    category: 'computo',      icon: 'fa-phone-volume' },
  AWS:              { label: 'AWS',                category: 'cloud',        icon: 'fa-aws' },
  Azure:            { label: 'Azure',              category: 'cloud',        icon: 'fa-microsoft' },
  Google_Cloud:     { label: 'Google Cloud',       category: 'cloud',        icon: 'fa-google' },
  VPN:              { label: 'VPN Tunnel',         category: 'cloud',        icon: 'fa-user-shield' },
  Internet:         { label: 'Internet',           category: 'cloud',        icon: 'fa-globe' },
  ISP:              { label: 'ISP',                category: 'cloud',        icon: 'fa-tower-cell' },
  DNS:              { label: 'DNS',                category: 'logica',       icon: 'fa-list-ol' },
  DHCP:             { label: 'DHCP',               category: 'logica',       icon: 'fa-arrows-to-dot' },
  AD:               { label: 'Active Directory',   category: 'logica',       icon: 'fa-folder-tree' },
  LDAP:             { label: 'LDAP',               category: 'logica',       icon: 'fa-address-book' },
  Base_de_Datos:    { label: 'Base de Datos',      category: 'logica',       icon: 'fa-database' },
  Aplicacion:       { label: 'Aplicación',         category: 'logica',       icon: 'fa-window-maximize' },
  API:              { label: 'API Endpoint',        category: 'logica',       icon: 'fa-gears' },
  Microservicio:    { label: 'Microservicio',       category: 'logica',       icon: 'fa-puzzle-piece' },
  VLAN:             { label: 'VLAN',               category: 'logica',       icon: 'fa-network-wired' },
  Subred:           { label: 'Subred / Subnet',    category: 'logica',       icon: 'fa-circle-nodes' },
  Usuario:          { label: 'Usuario',            category: 'organizacion', icon: 'fa-user' },
  Departamento:     { label: 'Departamento',       category: 'organizacion', icon: 'fa-sitemap' },
  Area:             { label: 'Área',               category: 'organizacion', icon: 'fa-users-gear' },
  Dependencia:      { label: 'Dependencia',        category: 'organizacion', icon: 'fa-code-branch' },
  // NUEVOS ELEMENTOS
  MPLS:             { label: 'Enlace MPLS',        category: 'cloud',        icon: 'fa-project-diagram' },
  SD_WAN:           { label: 'SD-WAN Edge',        category: 'red',          icon: 'fa-network-wired' },
  OLT:              { label: 'OLT (Fibra)',        category: 'red',          icon: 'fa-server' },
  ONT:              { label: 'ONT / CPE',          category: 'red',          icon: 'fa-modem' },
  ODF:              { label: 'ODF (Fibra)',        category: 'fisica',       icon: 'fa-grip-lines' },
  WLC:              { label: 'Controlador WiFi',   category: 'red',          icon: 'fa-satellite-dish' },
  vSwitch:          { label: 'Switch Virtual',     category: 'computo',      icon: 'fa-network-wired' },
  ESXi:             { label: 'Host ESXi / VMware', category: 'computo',      icon: 'fa-layer-group' },
  Proxmox:          { label: 'Host Proxmox',       category: 'computo',      icon: 'fa-box' },
  LUN:              { label: 'LUN (Almacenamiento)',category: 'computo',     icon: 'fa-hard-drive' },
  CCTV:             { label: 'Cámara CCTV',        category: 'red',          icon: 'fa-video' },
  NVR:              { label: 'NVR / DVR',          category: 'computo',      icon: 'fa-film' },
  Sensor_IoT:       { label: 'Sensor IoT',         category: 'red',          icon: 'fa-temperature-half' },
  PDU:              { label: 'PDU (Energía)',      category: 'fisica',       icon: 'fa-plug' },
  Generador:        { label: 'Planta Eléctrica',   category: 'fisica',       icon: 'fa-car-battery' },
  Antena_RF:        { label: 'Antena RF / Radio',  category: 'red',          icon: 'fa-tower-broadcast' },
};

const STATUS_COLORS = { online: '#10b981', maintenance: '#f59e0b', offline: '#ef4444' };
const CRITICALITY_COLORS = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444' };
const CRITICALITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };

// ─── DYNAMIC FIELD SCHEMAS ──────────────────────────────────────────────────
const DYNAMIC_SCHEMAS = {
  red: [
    { key: 'ip', label: 'Dirección IP', placeholder: '192.168.1.10' },
    { key: 'mac', label: 'Dirección MAC', placeholder: '00:1A:2B:3C:4D:5E' },
    { key: 'firmware', label: 'Versión Firmware', placeholder: 'v9.4.2' },
    { key: 'ports', label: 'Cant. Puertos / Interfaces', placeholder: '24' },
    { key: 'vlans', label: 'VLANs', placeholder: '10, 20, 30' },
    { key: 'routing', label: 'Enrutamiento', placeholder: 'OSPF, BGP, Estático' },
    { key: 'gateway', label: 'Gateway', placeholder: '192.168.1.1' },
    { key: 'mask', label: 'Máscara', placeholder: '255.255.255.0' },
  ],
  computo: [
    { key: 'ip', label: 'Dirección IP', placeholder: '10.0.0.5' },
    { key: 'hostname', label: 'Hostname', placeholder: 'srv-app-01' },
    { key: 'os', label: 'Sistema Operativo', placeholder: 'Ubuntu 22.04 / Windows Server' },
    { key: 'cpu', label: 'CPU (Cores)', placeholder: '8 Cores' },
    { key: 'ram', label: 'Memoria RAM', placeholder: '32 GB' },
    { key: 'disk', label: 'Almacenamiento / Disco', placeholder: '1 TB SSD' },
    { key: 'mac', label: 'Dirección MAC', placeholder: '00:1A:2B:3C:4D:5E' },
  ],
  logica: [
    { key: 'engine', label: 'Motor / Tecnología', placeholder: 'MySQL, Node.js, IIS' },
    { key: 'port', label: 'Puerto(s)', placeholder: '3306, 80, 443' },
    { key: 'url', label: 'Endpoint / URL', placeholder: 'https://api.empresa.com' },
    { key: 'environment', label: 'Entorno', placeholder: 'Producción, QA, Dev' },
    { key: 'version', label: 'Versión', placeholder: 'v2.1.0' },
  ],
  cloud: [
    { key: 'provider', label: 'Proveedor', placeholder: 'AWS, Azure, ISP Local' },
    { key: 'region', label: 'Región / Zona', placeholder: 'us-east-1' },
    { key: 'publicIp', label: 'IP Pública', placeholder: '203.0.113.10' },
    { key: 'asn', label: 'ASN (BGP)', placeholder: '65000' },
    { key: 'vrf', label: 'VRF / Tunnel ID', placeholder: 'VRF-Corp' },
    { key: 'bandwidth', label: 'Ancho de Banda', placeholder: '1 Gbps' },
  ],
  fisica: [
    { key: 'location', label: 'Ubicación Física', placeholder: 'DataCenter 1, Pasillo A' },
    { key: 'capacityU', label: 'Capacidad (Unidades de Rack)', placeholder: '42U' },
    { key: 'power', label: 'Capacidad Eléctrica (Watts/Amperios)', placeholder: '3000W / 15A' },
    { key: 'dimensions', label: 'Dimensiones', placeholder: '800x1200mm' },
    { key: 'cooling', label: 'Refrigeración', placeholder: 'Front-to-Back' },
  ],
  organizacion: [
    { key: 'responsable', label: 'Responsable', placeholder: 'Nombre del director/líder' },
    { key: 'email', label: 'Correo de Contacto', placeholder: 'admin@empresa.com' },
    { key: 'phone', label: 'Teléfono / Extensión', placeholder: 'Ext. 1234' },
    { key: 'costcenter', label: 'Centro de Costos', placeholder: 'CC-4050' },
  ]
};

const GENERIC_METADATA_FIELDS = [
  { key: 'vendor', label: 'Proveedor / Marca', placeholder: 'Cisco, Dell, HP...' },
  { key: 'model', label: 'Modelo', placeholder: 'PowerEdge R740...' },
  { key: 'serial', label: 'Número de Serial (S/N)', placeholder: 'S/N-12345678' },
];

// ─── SEARCHABLE CONTAINER SELECTOR COMPONENT ─────────────────────────────
const ParentSearchSelector = ({ value, onChange, allNodes, currentNodeId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  // Helper to find all descendants to avoid circular hierarchy
  const getDescendants = useCallback((nodeId, nodes) => {
    const descendants = new Set();
    const stack = [nodeId];
    while (stack.length > 0) {
      const curr = stack.pop();
      nodes.forEach(n => {
        if (n.data?.parentId === curr && !descendants.has(n.id)) {
          descendants.add(n.id);
          stack.push(n.id);
        }
      });
    }
    return descendants;
  }, []);

  // Filter valid potential parents: active nodes only, excluding current node and its descendants
  const validParents = useMemo(() => {
    const forbidden = getDescendants(currentNodeId, allNodes);
    forbidden.add(currentNodeId);
    return allNodes.filter(n => !forbidden.has(n.id));
  }, [allNodes, currentNodeId, getDescendants]);

  const filteredParents = useMemo(() => {
    if (!search) return validParents;
    const q = search.toLowerCase();
    return validParents.filter(n =>
      n.data?.name?.toLowerCase().includes(q) ||
      NODE_TYPES_CONFIG[n.data?.type]?.label?.toLowerCase().includes(q)
    );
  }, [validParents, search]);

  const selectedNode = useMemo(() => {
    return allNodes.find(n => n.id === value);
  }, [allNodes, value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="form-control"
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          cursor: 'pointer',
          background: 'var(--input-bg)',
          userSelect: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNode ? `${selectedNode.data.name} (${NODE_TYPES_CONFIG[selectedNode.data.type]?.label || selectedNode.data.type})` : 'Ninguno (Nivel Raíz)'}
        </span>
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--gray-text)', marginLeft: 8 }}></i>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxHeight: 220,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar nodo contenedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ fontSize: 12, padding: '4px 8px' }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: 4 }}>
            <div
              onClick={() => { onChange(null); setIsOpen(false); setSearch(''); }}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                background: !value ? 'var(--hover-bg)' : 'transparent',
                fontWeight: !value ? 600 : 400,
                color: !value ? 'var(--primary-color)' : 'var(--text-color)',
              }}
            >
              <i className="fa-solid fa-ban" style={{ marginRight: 6, opacity: 0.6 }}></i>
              Ninguno (Nivel Raíz)
            </div>

            {filteredParents.length === 0 ? (
              <div style={{ padding: '10px 8px', fontSize: 11, color: 'var(--gray-text)', textAlign: 'center' }}>
                No se encontraron nodos contenedores
              </div>
            ) : (
              filteredParents.map(n => {
                const conf = NODE_TYPES_CONFIG[n.data.type] || { label: n.data.type, icon: 'fa-cube' };
                const isSelected = n.id === value;
                return (
                  <div
                    key={n.id}
                    onClick={() => { onChange(n.id); setIsOpen(false); setSearch(''); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: isSelected ? 'var(--hover-bg)' : 'transparent',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--primary-color)' : 'var(--text-color)',
                    }}
                  >
                    <i className={resolveIcon(conf.icon)} style={{ width: 14, textAlignment: 'center', color: 'var(--primary-color)' }}></i>
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.data.name}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--gray-text)' }}>{conf.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CLUSTER NODE (container / group) ─────────────────────────────────────────
const ClusterNode = ({ data, selected }) => {
  const config = NODE_TYPES_CONFIG[data.type] || { label: data.type, category: 'fisica', icon: 'fa-cube' };
  const catConfig = NODE_CATEGORIES[config.category] || NODE_CATEGORIES.fisica;
  const childCount = data.childCount || 0;

  return (
    <div
      style={{
        border: `2px solid ${catConfig.color}`,
        borderRadius: '16px',
        background: selected ? `${catConfig.color}18` : `${catConfig.color}0a`,
        padding: '14px 18px',
        minWidth: '240px',
        cursor: 'pointer',
        boxShadow: selected ? `0 0 20px ${catConfig.color}55` : '0 4px 16px rgba(0,0,0,0.08)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle type="target" position={Position.Top} id="target-top" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Top} id="source-top" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="target" position={Position.Left} id="target-left" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Left} id="source-left" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="target" position={Position.Right} id="target-right" style={{ background: catConfig.color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="source-right" style={{ background: catConfig.color, width: 10, height: 10 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${catConfig.color}25`, color: catConfig.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          flexShrink: 0
        }}>
          <i className={resolveIcon(config.icon)}></i>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray-text)', marginTop: 1 }}>{config.label}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: STATUS_COLORS[data.status] || STATUS_COLORS.online,
            boxShadow: `0 0 6px ${STATUS_COLORS[data.status] || STATUS_COLORS.online}`
          }} />
          {childCount > 0 && (
            <div style={{ fontSize: 10, background: catConfig.color, color: 'white', borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>
              <i className="fa-solid fa-layer-group" style={{ marginRight: 4 }}></i>{childCount}
            </div>
          )}
        </div>
      </div>

      {data.metadata?.ip && (
        <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--gray-text)', background: 'var(--input-bg)', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
          {data.metadata.ip}
        </div>
      )}

      {childCount > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: catConfig.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-arrow-right-to-bracket"></i>
          Doble clic para expandir
        </div>
      )}
    </div>
  );
};

// ─── LEAF NODE ─────────────────────────────────────────────────────────────────
const LeafNode = ({ data, selected }) => {
  const config = NODE_TYPES_CONFIG[data.type] || { label: data.type, category: 'fisica', icon: 'fa-cube' };
  const catConfig = NODE_CATEGORIES[config.category] || NODE_CATEGORIES.fisica;

  return (
    <div style={{
      borderLeft: `5px solid ${catConfig.color}`,
      background: 'var(--card-bg)',
      borderRadius: 12,
      padding: '10px 14px',
      minWidth: 200,
      boxShadow: selected ? `0 0 15px ${catConfig.color}55` : '0 3px 10px rgba(0,0,0,0.07)',
      border: `1px solid ${selected ? catConfig.color : 'var(--border-color)'}`,
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top} id="target-top" style={{ background: catConfig.color }} />
      <Handle type="source" position={Position.Top} id="source-top" style={{ background: catConfig.color }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: catConfig.color }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: catConfig.color }} />
      <Handle type="target" position={Position.Left} id="target-left" style={{ background: catConfig.color }} />
      <Handle type="source" position={Position.Left} id="source-left" style={{ background: catConfig.color }} />
      <Handle type="target" position={Position.Right} id="target-right" style={{ background: catConfig.color }} />
      <Handle type="source" position={Position.Right} id="source-right" style={{ background: catConfig.color }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${catConfig.color}20`, color: catConfig.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
        }}>
          <i className={resolveIcon(config.icon)}></i>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--gray-text)' }}>{config.label}</div>
        </div>
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: STATUS_COLORS[data.status] || STATUS_COLORS.online,
          boxShadow: `0 0 5px ${STATUS_COLORS[data.status] || STATUS_COLORS.online}`,
          flexShrink: 0
        }} />
      </div>

      {(data.metadata?.ip || data.criticality === 'critical' || data.criticality === 'high') && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {data.metadata?.ip && (
            <span style={{ fontSize: 9, fontFamily: 'monospace', background: 'var(--input-bg)', borderRadius: 3, padding: '1px 5px', color: 'var(--gray-text)' }}>
              {data.metadata.ip}
            </span>
          )}
          {(data.criticality === 'critical' || data.criticality === 'high') && (
            <span style={{ fontSize: 9, background: `${CRITICALITY_COLORS[data.criticality]}20`, color: CRITICALITY_COLORS[data.criticality], borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
              {CRITICALITY_LABELS[data.criticality]}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── DAGRE AUTO LAYOUT ─────────────────────────────────────────────────────────
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 50 });
  nodes.forEach(n => g.setNode(n.id, { width: 240, height: 90 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: nodes.map(n => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - 120, y: pos.y - 45 } };
    }),
    edges,
  };
};

// ─── INNER CANVAS (needs useReactFlow) ────────────────────────────────────────
function TopologyCanvas({ allNodes, allEdges, setAllNodes, setAllEdges, systemData }) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Current cluster scope: null = root level, string = parentId being viewed
  const [currentParentId, setCurrentParentId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, label: 'Raíz' }]);

  // History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canvas view
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Determine child count for every node
  const childCountMap = useMemo(() => {
    const map = {};
    allNodes.forEach(n => {
      if (n.data.parentId) {
        map[n.data.parentId] = (map[n.data.parentId] || 0) + 1;
      }
    });
    return map;
  }, [allNodes]);

  // Build visible nodes for current level
  const buildView = useCallback((parentId, nodes, edges) => {
    const visibleNodes = nodes.filter(n =>
      (parentId === null ? !n.data.parentId : n.data.parentId === parentId)
    ).map(n => ({
      ...n,
      type: childCountMap[n.id] > 0 ? 'clusterNode' : 'leafNode',
      data: { ...n.data, childCount: childCountMap[n.id] || 0 },
    }));

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = edges.filter(e =>
      visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    return { visibleNodes, visibleEdges };
  }, [childCountMap]);

  // Sync view when parentId or allNodes change
  useEffect(() => {
    const { visibleNodes, visibleEdges } = buildView(currentParentId, allNodes, allEdges);
    setNodes(visibleNodes);
    setEdges(visibleEdges);
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
  }, [currentParentId, allNodes, allEdges, buildView, setNodes, setEdges, fitView]);

  // Push to history
  const pushHistory = useCallback((nodes, edges) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      return [...next, { nodes, edges }];
    });
    setHistoryIndex(i => i + 1);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setAllNodes(prev.nodes);
      setAllEdges(prev.edges);
      setHistoryIndex(i => i - 1);
      showToast('Deshecho', 'info');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setAllNodes(next.nodes);
      setAllEdges(next.edges);
      setHistoryIndex(i => i + 1);
      showToast('Rehecho', 'info');
    }
  };

  // Navigate into a cluster
  const drillDown = useCallback((nodeId, nodeName) => {
    setCurrentParentId(nodeId);
    setBreadcrumb(prev => [...prev, { id: nodeId, label: nodeName }]);
    setSelectedNode(null);
    setEditingNode(null);
  }, []);

  const navigateTo = useCallback((crumbIndex) => {
    const crumb = breadcrumb[crumbIndex];
    setCurrentParentId(crumb.id);
    setBreadcrumb(prev => prev.slice(0, crumbIndex + 1));
    setSelectedNode(null);
    setEditingNode(null);
  }, [breadcrumb]);

  // Auto layout
  const applyLayout = (dir) => {
    const { nodes: ln, edges: le } = getLayoutedElements(nodes, edges, dir);
    const updatedAll = allNodes.map(n => {
      const found = ln.find(l => l.id === n.id);
      return found ? { ...n, position: found.position } : n;
    });
    setAllNodes(updatedAll);
    pushHistory(updatedAll, allEdges);
    showToast('Layout aplicado', 'success');
  };

  // Save to server
  const handleSave = async () => {
    try {
      const payload = {
        nodes: allNodes.map(n => ({
          id: n.id,
          parentId: n.data.parentId || null,
          type: n.data.type,
          name: n.data.name,
          position: n.position,
          status: n.data.status || 'online',
          criticality: n.data.criticality || 'medium',
          metadata: n.data.metadata || {},
        })),
        edges: allEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.data?.type || 'physical',
          status: e.data?.status || 'active',
          label: e.label || '',
          color: e.data?.color || '',
          speed: e.data?.speed || '',
          metadata: e.data?.metadata || {},
        })),
      };
      const res = await topologyAPI.save(payload);
      if (res.data.success) showToast('Topología guardada con éxito', 'success');
    } catch (e) {
      showToast('Error al guardar', 'error');
    }
  };

  // Drag & Drop
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const config = NODE_TYPES_CONFIG[type] || { label: type };
    const id = `${type.toLowerCase()}_${Date.now()}`;

    const newNode = {
      id,
      type: 'leafNode',
      position,
      data: {
        name: config.label,
        type,
        status: 'online',
        criticality: 'medium',
        metadata: {},
        parentId: currentParentId || null,
        childCount: 0,
      },
    };

    const updatedAll = [...allNodes, newNode];
    setAllNodes(updatedAll);
    pushHistory(updatedAll, allEdges);
    setSelectedNode(newNode);
    setEditingNode(JSON.parse(JSON.stringify(newNode)));
  }, [allNodes, allEdges, currentParentId, screenToFlowPosition, setAllNodes, pushHistory]);

  // Create node from inventory item
  const addFromInventory = useCallback((item) => {
    const position = screenToFlowPosition({ x: 400 + Math.random() * 200, y: 300 + Math.random() * 150 });
    const id = `inv_${item.type}_${item.id}_${Date.now()}`;

    const newNode = {
      id,
      type: 'leafNode',
      position,
      data: {
        name: item.name,
        type: item.nodeType,
        status: item.estado === 'Activo' ? 'online' : item.estado === 'En mantenimiento' ? 'maintenance' : 'offline',
        criticality: 'medium',
        metadata: {
          ip: item.ip || '',
          serial: item.serial || '',
          model: item.model || '',
          area: item.area || '',
          inventoryId: item.id,
          inventoryTable: item.table,
        },
        parentId: currentParentId || null,
        childCount: 0,
      },
    };

    const updatedAll = [...allNodes, newNode];
    setAllNodes(updatedAll);
    pushHistory(updatedAll, allEdges);
    showToast(`${item.name} añadido al canvas`, 'success');
  }, [allNodes, allEdges, currentParentId, screenToFlowPosition, setAllNodes, pushHistory]);

  // Reconnect existing edge (change handles or targets)
  const onReconnect = useCallback((oldEdge, newConnection) => {
    const updated = allEdges.map(e => e.id === oldEdge.id ? { ...e, ...newConnection } : e);
    setAllEdges(updated);
    pushHistory(allNodes, updated);
    showToast('Conexión actualizada', 'info');
  }, [allNodes, allEdges, setAllEdges, pushHistory]);

  // Connect nodes
  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `edge_${Date.now()}`,
      type: 'default',
      animated: true,
      reconnectable: true,
      style: { stroke: '#4a6cf7', strokeWidth: 2 },
      data: { type: 'physical', status: 'active', color: '#4a6cf7', speed: '1 Gbps', metadata: {} },
    };
    const updated = addEdge(newEdge, allEdges);
    setAllEdges(updated);
    pushHistory(allNodes, updated);
  }, [allNodes, allEdges, setAllEdges, pushHistory]);

  // Node position update
  const onNodeDragStop = useCallback((_, node) => {
    const updatedAll = allNodes.map(n => n.id === node.id ? { ...n, position: node.position } : n);
    setAllNodes(updatedAll);
    pushHistory(updatedAll, allEdges);
  }, [allNodes, allEdges, setAllNodes, pushHistory]);

  // Double click to drill down
  const onNodeDoubleClick = useCallback((_, node) => {
    if ((node.data.childCount || 0) > 0) {
      drillDown(node.id, node.data.name);
    }
  }, [drillDown]);

  // UI state
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragFilter, setDragFilter] = useState('fisica');

  // Single click to select node
  const onNodeClick = useCallback((_, node) => {
    setSelectedEdge(null);
    setEditingEdge(null);
    setSelectedNode(node);
    setEditingNode(JSON.parse(JSON.stringify(node)));
    setActiveTab('general');
  }, []);

  // Single click to select edge
  const onEdgeClick = useCallback((_, edge) => {
    setSelectedNode(null);
    setEditingNode(null);
    setSelectedEdge(edge);
    setEditingEdge(JSON.parse(JSON.stringify(edge)));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setEditingNode(null);
    setSelectedEdge(null);
    setEditingEdge(null);
  }, []);

  // ── Helper: Get all descendants ─────────────────────────────────────────────
  const getAllDescendants = useCallback((parentId, nodesList) => {
    const descendants = new Set();
    const queue = [parentId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      nodesList.forEach(n => {
        if (n.data?.parentId === currentId && !descendants.has(n.id)) {
          descendants.add(n.id);
          queue.push(n.id);
        }
      });
    }
    return descendants;
  }, []);

  // ── Update node ─────────────────────────────────────────────────────────────
  const handleUpdateNode = () => {
    if (!editingNode) return;
    
    const originalNode = allNodes.find(n => n.id === editingNode.id);
    if (!originalNode) return;

    // Detect what changed (deltas)
    const oldData = originalNode.data || {};
    const newData = editingNode.data || {};
    
    const statusChanged = oldData.status !== newData.status;
    const criticalityChanged = oldData.criticality !== newData.criticality;
    
    const oldMeta = oldData.metadata || {};
    const newMeta = newData.metadata || {};
    const changedMetaKeys = Object.keys(newMeta).filter(k => newMeta[k] !== oldMeta[k]);

    // Find all children/descendants to cascade changes
    const descendants = getAllDescendants(editingNode.id, allNodes);

    const updatedAll = allNodes.map(n => {
      // 1. Update the parent itself
      if (n.id === editingNode.id) {
        return { 
          ...n, 
          data: { 
            ...n.data, 
            name: newData.name, 
            status: newData.status, 
            criticality: newData.criticality, 
            metadata: newData.metadata, 
            parentId: newData.parentId || null 
          } 
        };
      }
      
      // 2. Cascade changes to descendants
      if (descendants.has(n.id)) {
        let childData = { ...n.data };
        let modified = false;

        if (statusChanged) { childData.status = newData.status; modified = true; }
        if (criticalityChanged) { childData.criticality = newData.criticality; modified = true; }
        
        if (changedMetaKeys.length > 0) {
          childData.metadata = { ...(childData.metadata || {}) };
          changedMetaKeys.forEach(k => {
            childData.metadata[k] = newMeta[k];
          });
          modified = true;
        }

        if (modified) {
          return { ...n, data: childData };
        }
      }

      return n;
    });

    setAllNodes(updatedAll);
    pushHistory(updatedAll, allEdges);
    setSelectedNode(editingNode);

    if (descendants.size > 0 && (statusChanged || criticalityChanged || changedMetaKeys.length > 0)) {
      showToast(`Cambios aplicados y heredados a ${descendants.size} sub-nodo(s).`, 'success');
    } else {
      showToast('Cambios aplicados. Recuerda guardar.', 'info');
    }
  };

  // ── Update edge ──────────────────────────────────────────────────────────────
  const handleUpdateEdge = () => {
    if (!editingEdge) return;
    const color = editingEdge.data?.color || '#4a6cf7';
    const updatedEdges = allEdges.map(e => e.id === editingEdge.id
      ? {
          ...e,
          animated: editingEdge.animated,
          style: { stroke: color, strokeWidth: editingEdge.data?.strokeWidth || 2 },
          data: { ...e.data, ...editingEdge.data, color },
        }
      : e
    );
    setAllEdges(updatedEdges);
    pushHistory(allNodes, updatedEdges);
    setSelectedEdge(editingEdge);
    showToast('Conexión actualizada. Recuerda guardar.', 'info');
  };

  // ── Delete edge ──────────────────────────────────────────────────────────────
  const handleDeleteEdge = () => {
    if (!selectedEdge) return;
    Swal.fire({
      title: '¿Eliminar Conexión?',
      text: 'Se eliminará el enlace entre los dos nodos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      background: 'var(--card-bg)',
      color: 'var(--text-color)',
    }).then(res => {
      if (res.isConfirmed) {
        const updatedEdges = allEdges.filter(e => e.id !== selectedEdge.id);
        setAllEdges(updatedEdges);
        pushHistory(allNodes, updatedEdges);
        setSelectedEdge(null);
        setEditingEdge(null);
        showToast('Conexión eliminada', 'success');
      }
    });
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    Swal.fire({
      title: '¿Eliminar Nodo?',
      text: 'También se eliminarán sus conexiones. Esta acción no es permanente hasta que guardes.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      background: 'var(--card-bg)',
      color: 'var(--text-color)',
    }).then(res => {
      if (res.isConfirmed) {
        const updatedAll = allNodes.filter(n => n.id !== selectedNode.id);
        const updatedEdges = allEdges.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
        setAllNodes(updatedAll);
        setAllEdges(updatedEdges);
        pushHistory(updatedAll, updatedEdges);
        setSelectedNode(null);
        setEditingNode(null);
        showToast('Nodo eliminado', 'success');
      }
    });
  };

  const handleDuplicateNode = () => {
    if (!selectedNode) return;
    const id = `${selectedNode.data.type.toLowerCase()}_${Date.now()}`;
    const newNode = {
      ...selectedNode,
      id,
      position: { x: selectedNode.position.x + 30, y: selectedNode.position.y + 30 },
      data: { ...selectedNode.data, name: `${selectedNode.data.name} (Copia)`, childCount: 0 },
    };
    const updatedAll = [...allNodes, newNode];
    setAllNodes(updatedAll);
    pushHistory(updatedAll, allEdges);
    setSelectedNode(newNode);
    setEditingNode(JSON.parse(JSON.stringify(newNode)));
    showToast('Nodo duplicado', 'success');
  };

  // Export JSON
  const handleExportJSON = () => {
    const payload = {
      nodes: allNodes.map(n => ({ id: n.id, parentId: n.data.parentId, type: n.data.type, name: n.data.name, position: n.position, status: n.data.status, criticality: n.data.criticality, metadata: n.data.metadata })),
      edges: allEdges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.data?.type, status: e.data?.status, label: e.label, color: e.data?.color, speed: e.data?.speed })),
    };
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    a.download = `gestionti_topologia_${Date.now()}.json`;
    a.click();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.nodes && data.edges) {
          const fn = data.nodes.map(n => ({ id: n.id, type: (n.childCount || 0) > 0 ? 'clusterNode' : 'leafNode', position: n.position, data: { name: n.name, type: n.type, status: n.status, criticality: n.criticality, metadata: n.metadata || {}, parentId: n.parentId, childCount: 0 } }));
          const fe = data.edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: 'default', animated: true, style: { stroke: e.color || '#4a6cf7', strokeWidth: 2 }, data: { type: e.type, status: e.status, color: e.color, speed: e.speed } }));
          setAllNodes(fn);
          setAllEdges(fe);
          pushHistory(fn, fe);
          showToast('Topología importada', 'success');
        } else showToast('Formato inválido', 'error');
      } catch { showToast('Error al leer el archivo', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered nodes for search + highlight selected edge
  const displayNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: (n.data.name.toLowerCase().includes(q) || n.data.type.toLowerCase().includes(q) || n.data.metadata?.ip?.includes(q)) ? 1 : 0.25,
      },
    }));
  }, [nodes, searchQuery]);

  const displayEdges = useMemo(() => {
    return edges.map(e => ({
      ...e,
      selected: e.id === selectedEdge?.id,
      style: {
        ...(e.style || {}),
        stroke: e.id === selectedEdge?.id ? '#f59e0b' : (e.data?.color || '#4a6cf7'),
        strokeWidth: e.id === selectedEdge?.id ? 3 : (e.data?.strokeWidth || 2),
      },
    }));
  }, [edges, selectedEdge]);

  const nodeTypes = useMemo(() => ({ clusterNode: ClusterNode, leafNode: LeafNode }), []);

  // Inventory items flattened
  const inventoryItems = useMemo(() => {
    if (!systemData) return [];
    const items = [];
    (systemData.equipos || []).forEach(e => items.push({ id: e.id, name: e.nombre_equipo || e.nombre || `Equipo #${e.id}`, nodeType: e.laptop ? 'Laptop' : 'PC', estado: e.estado, serial: e.serial, model: e.nombre_marca, area: e.nombre_area, ip: '', table: 'equipos' }));
    (systemData.areas || []).forEach(a => items.push({ id: a.id, name: a.nombre_area, nodeType: 'Area', estado: 'Activo', serial: '', model: '', area: a.nombre_area, ip: '', table: 'areas' }));
    (systemData.funcionarios || []).forEach(f => items.push({ id: f.id, name: `${f.nombre} ${f.apellido}`, nodeType: 'Usuario', estado: 'Activo', serial: '', model: '', area: f.nombre_area, ip: '', table: 'funcionarios' }));
    return items;
  }, [systemData]);

  const filteredInventory = useMemo(() => {
    if (!searchQuery) return inventoryItems;
    const q = searchQuery.toLowerCase();
    return inventoryItems.filter(i => i.name.toLowerCase().includes(q) || i.area?.toLowerCase().includes(q));
  }, [inventoryItems, searchQuery]);

  const styles = {
    toolbar: {
      background: 'var(--card-bg)',
      borderBottom: '1px solid var(--border-color)',
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    tbBtn: (active) => ({
      padding: '6px 12px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      background: active ? 'var(--primary-color)' : 'var(--input-bg)',
      color: active ? 'white' : 'var(--text-color)',
      fontSize: 12,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      transition: 'all 0.2s',
    }),
    input: {
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid var(--border-color)',
      background: 'var(--input-bg)',
      color: 'var(--text-color)',
      fontSize: 12,
      outline: 'none',
    },
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', overflow: 'hidden', position: 'relative' }}>
      {/* LEFT PANEL: element library */}
      <div style={{ width: 270, background: 'var(--card-bg)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-color)', marginBottom: 8 }}>
            <i className="fa-solid fa-plus-circle" style={{ color: 'var(--primary-color)', marginRight: 6 }}></i>
            Añadir Elemento
          </div>
          <input
            placeholder="Buscar nodo o equipo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...styles.input, width: '100%' }}
          />
        </div>

        {/* Tabs: Tipos / Inventario */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          {['tipos', 'inventario'].map(t => (
            <button key={t} onClick={() => setActiveTab(t === activeTab ? activeTab : t)}
              style={styles.tbBtn(activeTab === t)}
              className={activeTab === t ? '' : 'settings-tab'}
            >
              <i className={`fa-solid ${t === 'tipos' ? 'fa-cubes' : 'fa-boxes-stacked'}`}></i>
              {t === 'tipos' ? 'Tipos' : 'Inventario'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {activeTab !== 'inventario' ? (
            <>
              {/* Category filter */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                {Object.entries(NODE_CATEGORIES).map(([key, val]) => (
                  <button key={key} onClick={() => setDragFilter(key)}
                    style={{ ...styles.tbBtn(dragFilter === key), fontSize: 10, padding: '4px 6px', justifyContent: 'center' }}>
                    <i className={`fa-solid ${val.icon}`} style={{ color: dragFilter === key ? 'white' : val.color }}></i>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              {/* Draggable items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {Object.entries(NODE_TYPES_CONFIG)
                  .filter(([_, c]) => c.category === dragFilter)
                  .map(([key, conf]) => (
                    <div key={key} draggable
                      onDragStart={e => e.dataTransfer.setData('application/reactflow', key)}
                      style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--input-bg)', border: '1px dashed var(--border-color)', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, userSelect: 'none', transition: 'all 0.15s' }}
                    >
                      <i className={resolveIcon(conf.icon)} style={{ color: NODE_CATEGORIES[conf.category].color, width: 16, textAlign: 'center' }}></i>
                      {conf.label}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            /* Inventory items */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {filteredInventory.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-text)', padding: 20, fontSize: 12 }}>
                  <i className="fa-solid fa-box-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }}></i>
                  Sin resultados
                </div>
              ) : filteredInventory.map(item => (
                <div key={`${item.table}_${item.id}`}
                  onClick={() => addFromInventory(item)}
                  style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 11, transition: 'all 0.15s' }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 2 }}>{item.name}</div>
                  <div style={{ color: 'var(--gray-text)', display: 'flex', gap: 8 }}>
                    <span>{item.nodeType}</span>
                    {item.area && <span>· {item.area}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CENTER: ReactFlow canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, overflow: 'hidden' }}>
            {breadcrumb.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: 'var(--gray-text)' }}></i>}
                <button onClick={() => navigateTo(idx)}
                  style={{ ...styles.tbBtn(idx === breadcrumb.length - 1), maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {idx === 0 ? <i className="fa-solid fa-house"></i> : null}
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border-color)', flexShrink: 0 }} />

          <button onClick={() => applyLayout('TB')} style={styles.tbBtn(false)} title="Layout Vertical">
            <i className="fa-solid fa-sitemap"></i>
          </button>
          <button onClick={() => applyLayout('LR')} style={styles.tbBtn(false)} title="Layout Horizontal">
            <i className="fa-solid fa-arrows-left-right"></i>
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--border-color)', flexShrink: 0 }} />

          <button onClick={handleUndo} disabled={historyIndex <= 0} style={styles.tbBtn(false)} title="Deshacer">
            <i className="fa-solid fa-rotate-left"></i>
          </button>
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} style={styles.tbBtn(false)} title="Rehacer">
            <i className="fa-solid fa-rotate-right"></i>
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--border-color)', flexShrink: 0 }} />

          <button onClick={handleSave} style={{ ...styles.tbBtn(false), background: 'var(--primary-color)', color: 'white' }}>
            <i className="fa-solid fa-floppy-disk"></i> Guardar
          </button>

          <button onClick={handleExportJSON} style={styles.tbBtn(false)} title="Exportar JSON">
            <i className="fa-solid fa-download"></i>
          </button>

          <label style={{ ...styles.tbBtn(false), cursor: 'pointer', margin: 0 }} title="Importar JSON">
            <i className="fa-solid fa-upload"></i>
            <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'hidden' }} onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={4}
            reconnectRadius={20}
            defaultEdgeOptions={{
              animated: true,
              reconnectable: true,
              style: { stroke: 'var(--primary-color)', strokeWidth: 2 },
            }}
          >
            <Background color="var(--border-color)" gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={n => {
                const type = n.data?.type;
                const cat = NODE_TYPES_CONFIG[type]?.category;
                return NODE_CATEGORIES[cat]?.color || '#888';
              }}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
            />

            {/* Level indicator */}
            <Panel position="bottom-center">
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '4px 14px', fontSize: 11, color: 'var(--gray-text)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-layer-group" style={{ color: 'var(--primary-color)' }}></i>
                Nivel {breadcrumb.length - 1} · {displayNodes.length} nodos visibles
                {currentParentId && (
                  <span style={{ color: 'var(--primary-color)', cursor: 'pointer', marginLeft: 8, fontWeight: 600 }} onClick={() => navigateTo(breadcrumb.length - 2)}>
                    <i className="fa-solid fa-arrow-left" style={{ marginRight: 4 }}></i>Subir nivel
                  </span>
                )}
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* RIGHT PANEL: node details */}
      {selectedNode && editingNode && (
        <div style={{ width: 360, background: 'var(--card-bg)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-color)' }}>
                {NODE_TYPES_CONFIG[editingNode.data.type]?.label || editingNode.data.type}
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray-text)', fontFamily: 'monospace', marginTop: 2 }}>{editingNode.id}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(editingNode.data.childCount || 0) > 0 && (
                <button className="action-btn" onClick={() => drillDown(editingNode.id, editingNode.data.name)} title="Expandir hijos">
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                </button>
              )}
              <button className="action-btn" onClick={() => setSelectedNode(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--input-bg)', overflowX: 'auto' }}>
            {['general', 'attributes', 'docs'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: '0 0 auto', padding: '9px 14px', background: activeTab === tab ? 'var(--card-bg)' : 'transparent', color: activeTab === tab ? 'var(--primary-color)' : 'var(--gray-text)', fontWeight: activeTab === tab ? 600 : 400, border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                {{ general: 'General', attributes: 'Detalles', docs: 'Docs' }[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label>Nombre del Nodo</label>
                  <input type="text" className="form-control"
                    value={editingNode.data.name}
                    onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, name: e.target.value } })}
                  />
                </div>

                <div className="form-group">
                  <label>Nodo Contenedor (Padre)</label>
                  <ParentSearchSelector
                    value={editingNode.data.parentId || null}
                    onChange={val => setEditingNode({ ...editingNode, data: { ...editingNode.data, parentId: val } })}
                    allNodes={allNodes}
                    currentNodeId={editingNode.id}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Estado</label>
                    <select className="form-control"
                      value={editingNode.data.status}
                      onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, status: e.target.value } })}
                    >
                      <option value="online">Online</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Criticidad</label>
                    <select className="form-control"
                      value={editingNode.data.criticality}
                      onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, criticality: e.target.value } })}
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="action-btn" onClick={handleDuplicateNode} style={{ flex: 1, justifyContent: 'center', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <i className="fa-solid fa-copy"></i> Duplicar
                  </button>
                  <button className="action-btn" onClick={handleDeleteNode} style={{ flex: 1, justifyContent: 'center', display: 'flex', gap: 6, alignItems: 'center', color: 'var(--error-color)' }}>
                    <i className="fa-solid fa-trash"></i> Eliminar
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'attributes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Dynamic fields based on category */}
                {(DYNAMIC_SCHEMAS[NODE_TYPES_CONFIG[editingNode.data.type]?.category] || []).map(f => (
                  <div key={f.key} className="form-group">
                    <label>{f.label}</label>
                    <input type="text" className="form-control" placeholder={f.placeholder}
                      value={editingNode.data.metadata?.[f.key] || ''}
                      onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, metadata: { ...editingNode.data.metadata, [f.key]: e.target.value } } })}
                    />
                  </div>
                ))}
                
                {/* Generic fields */}
                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 4, paddingTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Info General / Hardware</div>
                  {GENERIC_METADATA_FIELDS.map(f => (
                    <div key={f.key} className="form-group">
                      <label>{f.label}</label>
                      <input type="text" className="form-control" placeholder={f.placeholder}
                        value={editingNode.data.metadata?.[f.key] || ''}
                        onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, metadata: { ...editingNode.data.metadata, [f.key]: e.target.value } } })}
                      />
                    </div>
                  ))}
                  <div className="form-group">
                    <label>Notas Adicionales</label>
                    <textarea className="form-control" rows={3} placeholder="Anotaciones, advertencias..."
                      value={editingNode.data.metadata?.notes || ''}
                      onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, metadata: { ...editingNode.data.metadata, notes: e.target.value } } })}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label>URL de Documentación / Wiki</label>
                  <input type="url" className="form-control" placeholder="https://..."
                    value={editingNode.data.metadata?.wikiUrl || ''}
                    onChange={e => setEditingNode({ ...editingNode, data: { ...editingNode.data, metadata: { ...editingNode.data.metadata, wikiUrl: e.target.value } } })}
                  />
                </div>
                {editingNode.data.metadata?.wikiUrl && (
                  <a href={editingNode.data.metadata.wikiUrl} target="_blank" rel="noreferrer"
                    className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', textDecoration: 'none', padding: '8px 14px' }}>
                    <i className="fa-solid fa-arrow-up-right-from-square"></i> Abrir Documento
                  </a>
                )}
                {editingNode.data.metadata?.inventoryId && (
                  <div style={{ background: 'var(--input-bg)', borderRadius: 8, padding: 12, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-color)' }}>
                      <i className="fa-solid fa-link" style={{ color: 'var(--primary-color)', marginRight: 6 }}></i>
                      Vinculado al Inventario
                    </div>
                    <div style={{ color: 'var(--gray-text)' }}>ID: {editingNode.data.metadata.inventoryId} · Tabla: {editingNode.data.metadata.inventoryTable}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Apply button */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)' }}>
            <button className="btn-save" onClick={handleUpdateNode} style={{ width: '100%', justifyContent: 'center' }}>
              <i className="fa-solid fa-check"></i> Aplicar Cambios
            </button>
          </div>
        </div>
      )}

      {/* ══ RIGHT PANEL: edge details ══════════════════════════════════════════════════ */}
      {selectedEdge && editingEdge && !selectedNode && (
        <div style={{ width: 360, background: 'var(--card-bg)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-arrow-right-arrow-left" style={{ color: '#f59e0b' }}></i>
                Editar Conexión
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray-text)', fontFamily: 'monospace', marginTop: 2 }}>{editingEdge.id}</div>
            </div>
            <button className="action-btn" onClick={() => { setSelectedEdge(null); setEditingEdge(null); }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Source → Target indicator */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ flex: 1, background: 'var(--input-bg)', borderRadius: 6, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 10, color: 'var(--gray-text)', marginBottom: 2 }}>Origen</div>
              <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                {allNodes.find(n => n.id === editingEdge.source)?.data?.name || editingEdge.source}
              </div>
            </div>
            <i className="fa-solid fa-arrow-right" style={{ color: '#f59e0b', flexShrink: 0 }}></i>
            <div style={{ flex: 1, background: 'var(--input-bg)', borderRadius: 6, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 10, color: 'var(--gray-text)', marginBottom: 2 }}>Destino</div>
              <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                {allNodes.find(n => n.id === editingEdge.target)?.data?.name || editingEdge.target}
              </div>
            </div>
          </div>

          {/* Form body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label>Etiqueta / Label</label>
              <input type="text" className="form-control" placeholder="Ej: 1 Gbps, WAN Link…"
                value={editingEdge.label || ''}
                onChange={e => setEditingEdge({ ...editingEdge, label: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Tipo de Conexión</label>
              <select className="form-control"
                value={editingEdge.data?.connType || 'physical'}
                onChange={e => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, connType: e.target.value } })}
              >
                <option value="physical">Físico (Cable)</option>
                <option value="fiber">Fibra Óptica</option>
                <option value="wireless">Inalámbrico / WiFi</option>
                <option value="vpn">VPN Tunnel</option>
                <option value="wan">Enlace WAN</option>
                <option value="logical">Lógico / Virtual</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Estado</label>
                <select className="form-control"
                  value={editingEdge.data?.status || 'active'}
                  onChange={e => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, status: e.target.value } })}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="degraded">Degradado</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Velocidad / BW</label>
                <input type="text" className="form-control" placeholder="1 Gbps"
                  value={editingEdge.data?.speed || ''}
                  onChange={e => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, speed: e.target.value } })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Color del Enlace</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color"
                    value={editingEdge.data?.color || '#4a6cf7'}
                    onChange={e => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, color: e.target.value } })}
                    style={{ width: 40, height: 32, borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2, background: 'transparent' }}
                  />
                  <input type="text" className="form-control"
                    value={editingEdge.data?.color || '#4a6cf7'}
                    onChange={e => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, color: e.target.value } })}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                    placeholder="#4a6cf7"
                  />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Grosor (px)</label>
                <input type="number" className="form-control" min={1} max={10}
                  value={editingEdge.data?.strokeWidth || 2}
                  onChange={e => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, strokeWidth: Number(e.target.value) } })}
                />
              </div>
            </div>

            {/* Quick colour palette */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-text)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Paleta rápida</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { color: '#4a6cf7', label: 'Azul — físico' },
                  { color: '#10b981', label: 'Verde — activo' },
                  { color: '#f59e0b', label: 'Naranja — WAN' },
                  { color: '#ef4444', label: 'Rojo — crítico' },
                  { color: '#8b5cf6', label: 'Morado — VPN' },
                  { color: '#6b7280', label: 'Gris — inactivo' },
                ].map(({ color, label }) => (
                  <div key={color} title={label}
                    onClick={() => setEditingEdge({ ...editingEdge, data: { ...editingEdge.data, color } })}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', background: color, cursor: 'pointer',
                      border: editingEdge.data?.color === color ? '3px solid var(--text-color)' : '2px solid transparent',
                      transition: 'transform 0.15s, border 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Animated toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--input-bg)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-color)' }}>Animación de flujo</div>
                <div style={{ fontSize: 11, color: 'var(--gray-text)' }}>Muestra dirección del tráfico</div>
              </div>
              <label className="switch">
                <input type="checkbox"
                  checked={editingEdge.animated !== false}
                  onChange={e => setEditingEdge({ ...editingEdge, animated: e.target.checked })}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ padding: '10px 12px', background: 'var(--input-bg)', borderRadius: 8, fontSize: 12, color: 'var(--gray-text)' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#f59e0b', marginRight: 6 }}></i>
              Para mover un extremo de la conexión, arrastra el punto final directamente hacia otro nodo en el canvas.
            </div>

            <button onClick={handleDeleteEdge}
              style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '8px 12px', border: '1px solid var(--error-color)', borderRadius: 8, background: 'transparent', color: 'var(--error-color)', cursor: 'pointer', fontSize: 13 }}>
              <i className="fa-solid fa-trash"></i> Eliminar Conexión
            </button>
          </div>

          {/* Apply */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)' }}>
            <button className="btn-save" onClick={handleUpdateEdge} style={{ width: '100%', justifyContent: 'center' }}>
              <i className="fa-solid fa-check"></i> Aplicar Cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT PAGE COMPONENT ────────────────────────────────────────────────────────
export default function Topology() {
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemData, setSystemData] = useState(null);

  // Load topology + system data
  const cargarTopologia = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [topoRes, equipRes, areasRes, funcRes] = await Promise.all([
        topologyAPI.data(),
        equipmentAPI.list().catch(() => ({ data: { data: {} } })),
        auxAPI.areas().catch(() => ({ data: { data: [] } })),
        auxAPI.funcionarios().catch(() => ({ data: { data: [] } })),
      ]);

      // Load topology
      if (topoRes.data?.success) {
        const { nodes: rawNodes, edges: rawEdges } = topoRes.data.data;
        const childMap = {};
        rawNodes.forEach(n => { if (n.parentId) childMap[n.parentId] = (childMap[n.parentId] || 0) + 1; });
        const fn = rawNodes.map(n => ({
          id: n.id,
          type: childMap[n.id] > 0 ? 'clusterNode' : 'leafNode',
          position: n.position,
          data: { name: n.name, type: n.type, status: n.status, criticality: n.criticality, metadata: n.metadata || {}, parentId: n.parentId, childCount: childMap[n.id] || 0 },
        }));
        const fe = rawEdges.map(e => ({
          id: e.id, source: e.source, target: e.target, type: 'default', animated: true,
          style: { stroke: e.color || '#4a6cf7', strokeWidth: 2 },
          data: { type: e.type, status: e.status, color: e.color, speed: e.speed },
        }));
        setAllNodes(fn);
        setAllEdges(fe);
      }

      // Load system data
      const eqData = equipRes.data?.data || {};
      setSystemData({
        equipos: eqData.equipos || [],
        areas: areasRes.data?.data || [],
        funcionarios: funcRes.data?.data || [],
      });
    } catch (err) {
      if (!silent) showToast('Error al cargar topología', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    cargarTopologia(false);
  }, [cargarTopologia]);

  // Real-time synchronization via SSE (rt:system_update)
  useEffect(() => {
    const handleSystemUpdate = () => {
      cargarTopologia(true);
    };
    window.addEventListener('rt:system_update', handleSystemUpdate);
    return () => window.removeEventListener('rt:system_update', handleSystemUpdate);
  }, [cargarTopologia]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 130px)', background: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 36, color: 'var(--primary-color)' }}></i>
          <p style={{ marginTop: 12, color: 'var(--gray-text)' }}>Cargando topología...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: 'calc(100vh - 70px)' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, padding: '0 0 16px 0' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color)', margin: 0 }}>
            <i className="fa-solid fa-network-wired" style={{ color: 'var(--primary-color)', marginRight: 10 }}></i>
            Network Topology Engine
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-text)' }}>
            Diseña y documenta la infraestructura tecnológica de la organización en tiempo real
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', borderRadius: 20, padding: '4px 12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, border: '1px solid rgba(16,185,129,0.3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', display: 'inline-block' }}></span>
            Tiempo Real Activo
          </span>
          <span style={{ fontSize: 11, background: 'var(--input-bg)', borderRadius: 6, padding: '4px 10px', color: 'var(--gray-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-info-circle" style={{ color: 'var(--primary-color)' }}></i>
            Doble clic para entrar en un grupo
          </span>
        </div>
      </div>

      {/* React Flow provider wraps the canvas */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px var(--shadow-color)' }}>
        <ReactFlowProvider>
          <TopologyCanvas
            allNodes={allNodes}
            allEdges={allEdges}
            setAllNodes={setAllNodes}
            setAllEdges={setAllEdges}
            systemData={systemData}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
