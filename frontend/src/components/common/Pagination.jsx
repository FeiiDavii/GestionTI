import React from 'react';

export default function Pagination({ page, setPage, totalPages, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const maxButtons = 7;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const fromItem = totalItems > 0 ? ((page - 1) * pageSize) + 1 : 0;
  const toItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="pag-bar">
      <div className="pag-info">
        Mostrando <strong>{fromItem}–{toItem}</strong> de <strong>{totalItems}</strong>
      </div>
      <div className="pag-buttons">
        <button
          type="button"
          className="pag-btn btn-prev"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          title="Página anterior"
        >
          <i className="fa-solid fa-chevron-left" style={{ fontSize: '11px', marginRight: '5px' }} /> Anterior
        </button>

        {start > 1 && (
          <>
            <button type="button" className="pag-btn" onClick={() => setPage(1)}>1</button>
            {start > 2 && <span className="pag-dots">…</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            type="button"
            className={`pag-btn ${p === page ? 'pag-active' : ''}`}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="pag-dots">…</span>}
            <button type="button" className="pag-btn" onClick={() => setPage(totalPages)}>{totalPages}</button>
          </>
        )}

        <button
          type="button"
          className="pag-btn btn-next"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          title="Página siguiente"
        >
          Siguiente <i className="fa-solid fa-chevron-right" style={{ fontSize: '11px', marginLeft: '5px' }} />
        </button>
      </div>
    </div>
  );
}
