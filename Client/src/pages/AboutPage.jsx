import './AboutPage.css'

const aboutSections = [
  {
    title: 'App shell and navigation',
    howItWorks:
      'The layout keeps core pages in one navigation flow: Home, Profile, Payments, History, Status, and About.',
    whyUsed:
      'It is used to reduce friction, so actions stay organized and easy to find without jumping across unrelated screens.',
  },
  {
    title: 'Chat workspace',
    howItWorks:
      'Home combines contacts, conversation view, and message composer so sending and reading messages happens in one place.',
    whyUsed:
      'It is used for faster communication and cleaner daily chat flow.',
  },
  {
    title: 'Profile and personalization',
    howItWorks:
      'Profile lets you update display name, about text, status line, photo, and personal details from a single form.',
    whyUsed:
      'It is used to keep your account identity consistent across the whole app experience.',
  },
  {
    title: 'Payments and history',
    howItWorks:
      'Payments handles transfer actions, while History keeps a record of completed money activity for later review.',
    whyUsed:
      'It is used when chat and money tracking need to work together in one workspace.',
  },
  {
    title: 'Status updates',
    howItWorks:
      'Status lets you post short updates and media, then tracks engagement over the active story window.',
    whyUsed:
      'It is used for quick broadcast updates without opening direct conversations.',
  },
]

function AboutPage() {
  return (
    <section className="page-section about-grid">
      <section className="panel highlight-panel">
        <p className="section-eyebrow">About</p>
        <h2>About this app project</h2>
        <p className="lead-copy">
          This app is designed as one connected workspace for conversation, profile updates, status sharing,
          and payment actions.
        </p>
        <p className="muted-copy">
          It is used to keep communication, identity management, and transaction flow inside a single product journey.
        </p>
      </section>

      {aboutSections.map((section) => (
        <article key={section.title} className="panel highlight-card">
          <p className="section-eyebrow">Section</p>
          <h3>{section.title}</h3>
          <p><strong>How it works:</strong> {section.howItWorks}</p>
          <p><strong>Why it is used:</strong> {section.whyUsed}</p>
        </article>
      ))}
    </section>
  )
}

export default AboutPage