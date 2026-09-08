import { useState } from 'react';
import { AppFrame } from './components/AppFrame.jsx';
import { BottomTabs } from './components/BottomTabs.jsx';
import { HomePage } from './pages/home/HomePage.jsx';
import { ScanPage } from './pages/scan/ScanPage.jsx';
import { SearchPage } from './pages/search/SearchPage.jsx';
import { CollectionProvider } from './components/CollectionProvider.jsx';

const tabs = [
  {
    id: 'home',
    label: '홈',
    component: HomePage,
  },
  {
    id: 'scan',
    label: '스캔',
    component: ScanPage,
  },
  {
    id: 'search',
    label: '탐색',
    component: SearchPage,
  },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('home');
  const [openedHeritage, setOpenedHeritage] = useState(null);
  const [collectionRequest, setCollectionRequest] = useState(null);
  const moveTab = (tabId) => {
    setOpenedHeritage(null);
    setCollectionRequest(null);
    setActiveTabId(tabId);
  };
  const openCollection = (heritageId) => {
    setCollectionRequest({ heritageId });
    setOpenedHeritage(null);
    setActiveTabId('search');
  };
  const openHeritage = (heritage) => {
    setOpenedHeritage(heritage);
    setActiveTabId('scan');
  };
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const ActivePage = activeTab.component;

  return (
    <CollectionProvider>
      <AppFrame
        bottomNavigation={
          <BottomTabs tabs={tabs} activeTabId={activeTabId} onChange={moveTab} />
        }
      >
        <ActivePage
          key={`${activeTabId}:${openedHeritage?.id ?? 'default'}`}
          onMoveTab={moveTab}
          initialHeritage={openedHeritage}
          collectionRequest={collectionRequest}
          onOpenCollection={openCollection}
          onOpenHeritage={openHeritage}
        />
      </AppFrame>
    </CollectionProvider>
  );
}

export default App;
