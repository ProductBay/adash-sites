export function AdminPlatformFooter() {
  return <footer className="admin-platform-footer" aria-label="A’Dash platform information">
    <div className="platform-footer-inner">
      <div className="platform-footer-provider">
        <p>Technology powered by</p>
        <div className="platform-wordmark" aria-label="A’Dash Technologies Group">
          <strong>A’DASH</strong>
          <span>TECHNOLOGIES GROUP</span>
        </div>
      </div>
      <div className="platform-footer-meta">
        <p>Managed under the A’Dash Sites Operational Licence</p>
        <a href="https://adash.technology" target="_blank" rel="noopener noreferrer" aria-label="Visit A’Dash Technologies Group website (opens in a new tab)">adash.technology</a>
      </div>
    </div>
  </footer>;
}
