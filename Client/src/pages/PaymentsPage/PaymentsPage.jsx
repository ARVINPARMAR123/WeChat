import { useDeferredValue, useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { formatCurrency, formatDateTime } from '../../lib/formatters.js'
import useAutoDismissFeedback from '../../lib/useAutoDismissFeedback.js'
import './PaymentsPage.css'

function PaymentsPage() {
  const {
    directory,
    isAuthenticated,
    refreshTransactions,
    resolveContact,
    searchQuery,
    sendPayment,
    session,
    transactions,
    transactionsLoading,
  } = useAppContext()

  const deferredSearch = useDeferredValue(searchQuery)
  const [form, setForm] = useState({ recipientId: '', amount: '', note: '' })
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  useAutoDismissFeedback(feedback, setFeedback)

  const selectedRecipientId = form.recipientId || directory[0]?.id || ''

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')

    const result = await sendPayment({
      ...form,
      recipientId: selectedRecipientId,
    })
    setBusy(false)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    setFeedback('Transfer completed successfully.')
    setForm((current) => ({
      ...current,
      amount: '',
      note: '',
    }))
  }

  const incoming = transactions.reduce((sum, transaction) => (
    transaction.recipientId === session.userId ? sum + Number(transaction.amount || 0) : sum
  ), 0)

  const outgoing = transactions.reduce((sum, transaction) => (
    transaction.senderId === session.userId ? sum + Number(transaction.amount || 0) : sum
  ), 0)

  const visibleTransactions = transactions.filter((transaction) => {
    if (!deferredSearch.trim()) {
      return true
    }

    const counterpartId = transaction.senderId === session.userId
      ? transaction.recipientId
      : transaction.senderId
    const counterpart = resolveContact(counterpartId)
    const query = deferredSearch.trim().toLowerCase()

    return [
      counterpart?.alias,
      counterpart?.username,
      counterpart?.email,
      transaction.status,
      String(transaction.amount),
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })

  const recentTransactions = visibleTransactions.slice(0, 3)

  return (
    <section className="page-section payments-grid">
      <section className="panel payment-form-panel">
        <div className="split-header">
          <div>
            <p className="section-eyebrow">Payments</p>
            <h2>Send Money to Friend</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => refreshTransactions()}>
            Refresh history
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Recipient</span>
            <select name="recipientId" value={selectedRecipientId} onChange={handleChange} disabled={!directory.length}>
              {directory.length ? null : <option value="">No contacts available</option>}
              {directory.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.alias || contact.username}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Amount</span>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              placeholder="00"
            />
          </label>

          <label>
            <span>Note</span>
            <textarea
              name="note"
              rows="3"
              value={form.note}
              onChange={handleChange}
              placeholder="Send a message"
            />
          </label>

          <button type="submit" className="primary-button" disabled={!isAuthenticated || busy}>
            {busy ? 'Sending...' : 'Send Payment'}
          </button>
        </form>

        {feedback ? <p className="feedback-copy">{feedback}</p> : null}
      </section>

      <section className="stats-row payment-stats">
        <article className="panel stat-card warm-card">
          <p className="section-eyebrow">Balance</p>
          <h3>{formatCurrency(session.walletBalance)}</h3>
          <p>current wallet snapshot</p>
        </article>
        <article className="panel stat-card warm-card">
          <p className="section-eyebrow">Incoming</p>
          <h3>{formatCurrency(incoming)}</h3>
          <p>received across history</p>
        </article>
        <article className="panel stat-card warm-card">
          <p className="section-eyebrow">Outgoing</p>
          <h3>{formatCurrency(outgoing)}</h3>
          <p>sent across history</p>
        </article>
      </section>

      <section className="panel transaction-list-panel">
        <div className="split-header">
          <div>
            <p className="section-eyebrow">History</p>
            <h2>Recent transfers</h2>
          </div>
          <span className="contact-tag">{transactionsLoading ? 'Syncing' : ` Last ${recentTransactions.length} records`}</span>
        </div>

        <div className="timeline-list">
          {recentTransactions.map((transaction) => {
            const isOutgoing = transaction.senderId === session.userId
            const counterpartId = isOutgoing ? transaction.recipientId : transaction.senderId
            const counterpart = resolveContact(counterpartId)

            return (
              <article key={transaction.id} className="timeline-item payment-item">
                <div>
                  <strong>
                    {isOutgoing ? 'Sent to ' : 'Received from '}
                    {counterpart?.alias || counterpart?.username || counterpartId}
                  </strong>
                  <p>{transaction.status} at {formatDateTime(transaction.createdAt)}</p>
                </div>
                <span className={`amount-pill ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                  {isOutgoing ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </span>
              </article>
            )
          })}

          {!recentTransactions.length ? (
            <div className="empty-state subtle">
              <h3>No transfers found</h3>
              <p>Send money from this page or widen the search filter.</p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  )
}

export default PaymentsPage
