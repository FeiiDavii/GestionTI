import React from 'react';

export default function Pagination({ page, setPage, totalPages, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const btnPageStyle = (active) => ({
    padding: '6px 12px',
    borderRadius: '8px',
    border: active ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
    background: active ? 'var(--primary-color)' : 'transparent',
    color: active ? '#fff' : 'var(--text-color)',
    cursor: 'pointer',
    fontWeight: active ? 700 : 500,
    fontSize: '13px',
    minWidth: '34px',
    transition: 'all 0.15s'
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
      marginTop: '15px',
      flexWrap: 'wrap',
      gap: '10px',
      padding: '10px 15px',
      background: 'var(--input-bg)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          className="action-btn btn-prev"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          style={{ opacity: page <= 1 ? 0.4 : 1, padding: '5px 10px', fontSize: '12px' }}
        >
          <i className="fa-solid fa-chevron-left" /> Anterior
        </button>
        {start > 1 && (
          <>
            <button style={btnPageStyle(false)} onClick={() => setPage(1)}>1</button>
            <span style={{ color: 'var(--gray-text)', fontSize: '12px', padding: '0 2px' }}>...</span>
          </>
        )}
        {pages.map(p => (
          <button key={p} style={btnPageStyle(p === page)} onClick={() => setPage(p)}>{p}</button>
        ))}
        {end < totalPages && (
          <>
            <span style={{ color: 'var(--gray-text)', fontSize: '12px', padding: '0 2px' }}>...</span>
            <button style={btnPageStyle(false)} onClick={() => setPage(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          className="action-btn btn-next"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          style={{ opacity: page >= totalPages ? 0.4 : 1, padding: '5px 10px', fontSize: '12px' }}
        >
          Siguiente <i className="fa-solid fa-chevron-right" />
        </button>
      </div>
      <span style={{ fontSize: '13px', color: 'var(--gray-text)' }}>
        {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalItems)} de {totalItems}
      </span>
    </div>
  );
}
