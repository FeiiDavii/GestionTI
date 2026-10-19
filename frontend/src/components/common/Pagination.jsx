import React from 'react';

export default function Pagination({ page, setPage, totalPages, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const btnPageStyle = (active) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    border: active ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
    background: active ? 'var(--primary-color)' : 'transparent',
    color: active ? '#fff' : 'var(--text-color)',
    cursor: 'pointer',
    fontWeight: active ? 600 : 500,
    fontSize: '12px',
    minWidth: '28px',
    fontFamily: 'var(--font-mono)',
    transition: 'all 0.12s ease'
  });

  const maxButtons = 7;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="pagination" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12px',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '8px 12px',
      background: 'var(--surface-secondary)',
      borderRadius: '6px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className="action-btn btn-prev"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          <i className="fa-solid fa-chevron-left" /> Anterior
        </button>
        {start > 1 && (
          <>
            <button style={btnPageStyle(false)} onClick={() => setPage(1)}>1</button>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '0 2px' }}>...</span>
          </>
        )}
        {pages.map(p => (
          <button key={p} style={btnPageStyle(p === page)} onClick={() => setPage(p)}>{p}</button>
        ))}
        {end < totalPages && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '0 2px' }}>...</span>
            <button style={btnPageStyle(false)} onClick={() => setPage(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          className="action-btn btn-next"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          Siguiente <i className="fa-solid fa-chevron-right" />
        </button>
      </div>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalItems)} de {totalItems}
      </span>
    </div>
  );
}

