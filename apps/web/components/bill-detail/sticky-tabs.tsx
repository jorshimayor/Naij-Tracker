const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'explainer', label: 'Plain English' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'documents', label: 'Documents' },
  { id: 'discussion', label: 'Discussion' },
];

export function StickyTabs() {
  return (
    <nav className="sticky top-0 z-10 -mx-4 mt-6 overflow-x-auto border-b border-border bg-card/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <ul className="container-wide flex gap-1 py-2 text-sm">
        {TABS.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className="block whitespace-nowrap rounded-md px-3 py-1.5 text-foreground/85 no-underline hover:bg-muted hover:text-flag-green-dark"
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
