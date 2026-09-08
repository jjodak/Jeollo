export function AppFrame({ children, bottomNavigation }) {
  return (
    <main className="app-shell">
      <section
        className="app-viewport app-viewport--immersive"
        aria-label="절로 앱 프로토타입"
      >
        <div className="page-body page-body--immersive">
          {children}
        </div>
        {bottomNavigation}
      </section>
    </main>
  );
}
