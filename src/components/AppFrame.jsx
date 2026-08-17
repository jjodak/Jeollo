export function AppFrame({ activeTab, children, bottomNavigation }) {
  return (
    <main className={activeTab.immersive ? 'app-shell app-shell--immersive' : 'app-shell'}>
      <section
        className={
          activeTab.immersive ? 'app-viewport app-viewport--immersive' : 'app-viewport'
        }
        aria-label="절로 앱 프로토타입"
      >
        {!activeTab.immersive ? (
          <header className="app-header">
            <div className="brand-row">
              <span className="brand-mark" aria-hidden="true">
                절
              </span>
              <div>
                <strong>절로 Jeollo</strong>
                <span>사찰 문화유산 큐레이션</span>
              </div>
            </div>
            <div className="page-heading">
              <p>{activeTab.label}</p>
              <h1>{activeTab.title}</h1>
              <span>{activeTab.description}</span>
            </div>
          </header>
        ) : null}
        <div className={activeTab.immersive ? 'page-body page-body--immersive' : 'page-body'}>
          {children}
        </div>
        {bottomNavigation}
      </section>
    </main>
  );
}
