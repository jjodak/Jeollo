import homeIcon from '../assets/figma/tabs/home.svg';
import homeActiveIcon from '../assets/figma/tabs/home-active.svg';
import scanIcon from '../assets/figma/tabs/scan.svg';
import scanActiveIcon from '../assets/figma/tabs/scan-active.svg';
import searchIcon from '../assets/figma/tabs/search.svg';
import searchActiveIcon from '../assets/figma/tabs/search-active.svg';
import mypageIcon from '../assets/figma/tabs/mypage.svg';
import mypageActiveIcon from '../assets/figma/tabs/mypage-active.svg';

const tabIcon = {
  home: { default: homeIcon, active: homeActiveIcon },
  scan: { default: scanIcon, active: scanActiveIcon },
  search: { default: searchIcon, active: searchActiveIcon },
  mypage: { default: mypageIcon, active: mypageActiveIcon },
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
            <img className="tab-icon-base" src={tabIcon[tab.id][tab.id === activeTabId ? 'active' : 'default']} alt="" />
          </span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
