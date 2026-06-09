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
      marginBottom: '15px',
      flexWrap: 'wrap',
      gap: '15px',
      padding: '10px 15px',
      background: 'var(--input-bg)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {showPageSize && (
          <div className="rows-per-page" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--gray-text)', fontWeight: 500 }}>Mostrar</label>
            <select
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                outline: 'none',
                cursor: 'pointer'
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
            <label style={{ fontSize: '13px', color: 'var(--gray-text)', fontWeight: 500 }}>registros</label>
          </div>
        )}

        <div className="table-info" style={{ fontSize: '13px', color: 'var(--gray-text)' }}>
          Mostrando {filteredItemsCount} de {totalItems} registros
        </div>
      </div>

      {showSearch && (
        <div className="search-box-modern" style={{
          background: 'var(--card-bg)',
          borderRadius: '20px',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          width: '260px',
          border: '1px solid var(--border-color)',
          transition: 'all 0.3s'
        }}>
          <i className="fa-solid fa-search" style={{ color: 'var(--gray-text)', fontSize: '14px' }}></i>
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
              marginLeft: '10px',
              color: 'var(--text-color)',
              fontSize: '13.5px'
            }}
          />
        </div>
      )}
    </div>
  );
}
