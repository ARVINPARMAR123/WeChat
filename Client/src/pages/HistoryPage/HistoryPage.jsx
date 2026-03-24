import { useDeferredValue } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { formatCurrency, formatDateTime } from '../../lib/formatters.js'
import './HistoryPage.css'

function HistoryPage() {
  const { resolveContact, searchQuery, session, transactions } = useAppContext()
  const deferredSearch = useDeferredValue(searchQuery)

  const timeline = transactions
    .map((transaction) => {
      const isOutgoing = transaction.senderId === session.userId
      const counterpartId = isOutgoing ? transaction.recipientId : transaction.senderId
      const counterpart = resolveContact(counterpartId)
      const note = typeof transaction.note === 'string' ? transaction.note.trim() : ''

      return {
        id: `transaction-${transaction.id}`,
        kind: 'transaction',
        title: `${isOutgoing ? 'Sent' : 'Received'} ${formatCurrency(transaction.amount)}`,
        detail: `${isOutgoing ? 'To' : 'From'}: ${counterpart?.alias || counterpart?.username || counterpartId} · Status: ${transaction.status || 'completed'}`,
        note,
        createdAt: transaction.createdAt,
      }
    })
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))

  const visibleItems = timeline.filter((item) => {
    if (!deferredSearch.trim()) {
      return true
    }

    const query = deferredSearch.trim().toLowerCase()
    return [item.title, item.detail, item.kind, item.note]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })

  return (
    <section className="page-section history-grid">
      <section className="panel highlight-panel">
        <p className="section-eyebrow">Transactions</p>
        <h2>Money transfer history</h2>
        <p className="lead-copy">
          Only wallet transfer records are shown here.
        </p>
      </section>

      <section className="panel timeline-panel">
        <div className="timeline-log-meta">
          <p className="section-eyebrow">Transaction log</p>
          <h2>{visibleItems.length} records</h2>
        </div>

        <div className="timeline-list">
          {visibleItems.map((item) => (
            <article key={item.id} className="timeline-item">
              <div className="timeline-content">
                <p className="section-eyebrow">{item.kind}</p>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                {item.note ? <p>Note: {item.note}</p> : null}
              </div>
              <span className="timeline-time">{formatDateTime(item.createdAt)}</span>
            </article>
          ))}

          {!visibleItems.length ? (
            <div className="empty-state subtle">
              <h3>No matching transactions</h3>
              <p>Try a broader search or create a new payment transfer.</p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  )
}

export default HistoryPage
