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
  hideSearch = false,
  searchPlaceholder = 'Buscar en la tabla...',
}) {
  const shouldShowSearch = showSearch && !hideSearch;

  return (
    <div className="table-controls">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {showPageSize && (
          <div className="rows-per-page">
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Mostrar</label>
            <select
              className="form-control-sm"
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>Todos</option>
            </select>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>registros</label>
          </div>
        )}

        <div className="table-info" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Mostrando <strong style={{ color: 'var(--text-color)', fontFamily: 'var(--font-mono)' }}>{filteredItemsCount}</strong> de{' '}
          <strong style={{ color: 'var(--text-color)', fontFamily: 'var(--font-mono)' }}>{totalItems}</strong> registros
        </div>
      </div>

      {shouldShowSearch && (
        <div className="search-box-modern">
          <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-tertiary)', fontSize: '12.5px' }}></i>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 2px' }}
              title="Limpiar filtro"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
