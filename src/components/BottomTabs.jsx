import homeIcon from '../assets/figma/home.svg';
import homeMarkIcon from '../assets/figma/home-mark.svg';
import homeSmallMarkIcon from '../assets/figma/home-small-mark.svg';
import scanIcon from '../assets/figma/scan.svg';
import searchIcon from '../assets/figma/search.svg';

const tabIcon = {
  home: homeIcon,
  scan: scanIcon,
  search: searchIcon,
};

export function BottomTabs({ tabs, activeTabId, onChange }) {
  return (
    <nav className="bottom-tabs" aria-label="주요 탭">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTabId ? 'active' : ''}
          onClick={() => onChange(tab.id)}
          aria-current={tab.id === activeTabId ? 'page' : undefined}
        >
          <span className={`tab-icon tab-icon--${tab.id}`} aria-hidden="true">
            <img className="tab-icon-base" src={tabIcon[tab.id]} alt="" />
            {tab.id === 'home' ? (
              <>
                <img className="home-icon-mark" src={homeMarkIcon} alt="" />
                <img className="home-icon-small-mark" src={homeSmallMarkIcon} alt="" />
                <span className="home-icon-notch" />
              </>
            ) : null}
          </span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
