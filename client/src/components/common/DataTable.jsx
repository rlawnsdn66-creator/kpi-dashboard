export default function DataTable({ columns, data, onRowClick, emptyMessage = '데이터가 없습니다' }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={col.width ? { width: col.width } : {}}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || i} onClick={() => onRowClick?.(row)} className={onRowClick ? 'clickable' : ''}>
              {columns.map(col => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
