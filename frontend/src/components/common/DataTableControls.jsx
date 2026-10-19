import React from 'react';

export default function DataTableControls({
  pageSize,
  setPageSize,
  searchTerm,
  setSearchTerm,
  totalItems,
  filteredItemsCount,
  showPageSize = true,
  showSearch = true,
  searchPlaceholder = 'Buscar en la tabla...',
}) {
  return (
    <div className="table-controls" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '8px 12px',
      background: 'var(--surface-secondary)',
      borderRadius: '6px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {showPageSize && (
          <div className="rows-per-page" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Mostrar</label>
            <select
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-primary)',
                color: 'var(--text-color)',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>Todos</option>
            </select>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>registros</label>
          </div>
        )}

        <div className="table-info" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Mostrando <strong style={{ color: 'var(--text-color)', fontFamily: 'var(--font-mono)' }}>{filteredItemsCount}</strong> de <strong style={{ color: 'var(--text-color)', fontFamily: 'var(--font-mono)' }}>{totalItems}</strong> registros
        </div>
      </div>

      {showSearch && (
        <div className="search-box-modern" style={{
          background: 'var(--surface-primary)',
          borderRadius: '4px',
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          width: '240px',
          border: '1px solid var(--border-color)',
          transition: 'all 0.15s'
        }}>
          <i className="fa-solid fa-search" style={{ color: 'var(--text-muted)', fontSize: '12px' }}></i>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              marginLeft: '8px',
              color: 'var(--text-color)',
              fontSize: '12.5px'
            }}
          />
        </div>
      )}
    </div>
  );
}

