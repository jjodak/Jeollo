import { useState } from 'react';
import { AppFrame } from './components/AppFrame.jsx';
import { BottomTabs } from './components/BottomTabs.jsx';
import { HomePage } from './pages/home/HomePage.jsx';
import { ScanPage } from './pages/scan/ScanPage.jsx';
import { SearchPage } from './pages/search/SearchPage.jsx';
import { CollectionProvider } from './components/CollectionProvider.jsx';
import { AuthProvider, useAuth } from './components/AuthProvider.jsx';
import { AuthPage } from './pages/auth/AuthPage.jsx';
import { MyPage } from './pages/mypage/MyPage.jsx';
import { RegionPicker } from './components/permissions/RegionPicker.jsx';

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
  { id: 'mypage', label: '내 정보', component: MyPage },
];

function AppContent() {
  const auth = useAuth();
  const [authRequest, setAuthRequest] = useState(null);
  const [activeTabId, setActiveTabId] = useState('home');
  const [openedHeritage, setOpenedHeritage] = useState(null);
  const [collectionRequest, setCollectionRequest] = useState(null);
  const [scanRequest, setScanRequest] = useState(null);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(() => {
    try { return localStorage.getItem('jeollo.region.v1') || null; } catch { return null; }
  });
  const moveTab = (tabId) => {
    setOpenedHeritage(null);
    setCollectionRequest(null);
    setScanRequest(null);
    setActiveTabId(tabId);
  };
  const openCollection = (heritageId) => {
    setCollectionRequest({ heritageId });
    setOpenedHeritage(null);
    setActiveTabId('search');
  };
  const openHeritage = (heritage) => {
    setScanRequest(null);
    setOpenedHeritage(heritage);
    setActiveTabId('scan');
  };
  const openScan = (file = null) => {
    setOpenedHeritage(null);
    setCollectionRequest(null);
    setScanRequest({ file, startCamera: !file });
    setActiveTabId('scan');
  };
  const useDeviceLocation = () => {
    setSelectedRegion(null);
    try { localStorage.removeItem('jeollo.region.v1'); sessionStorage.setItem('jeollo.location-intro.v1', 'allowed'); } catch { /* optional preference */ }
  };
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const ActivePage = activeTab.component;
  const gate = auth.passwordRecovery ? <AuthPage forceRecovery onClose={auth.finishPasswordRecovery} /> : !auth.authReady || auth.accountLoading
    ? <div className="account-loading" role="status">절로를 준비하고 있어요.</div>
    : auth.accountError
      ? <div className="account-loading"><p role="alert">{auth.accountError}</p><button className="account-text" onClick={auth.refreshAccount}>다시 시도</button><button className="account-text" onClick={() => auth.signOut().catch(() => {})}>로그아웃</button></div>
      : authRequest || (!auth.memberReady && !auth.guest)
        ? <AuthPage key={authRequest?.mode ?? 'welcome'} initialMode={authRequest?.mode}
          onClose={auth.guest || auth.memberReady ? () => setAuthRequest(null) : undefined} /> : null;

  return (
    <CollectionProvider>
      <AppFrame
        bottomNavigation={
          !gate ? <BottomTabs tabs={tabs} activeTabId={activeTabId} onChange={moveTab} /> : null
        }
      >
        {gate || <ActivePage
          key={`${activeTabId}:${openedHeritage?.id ?? 'default'}`}
          onMoveTab={moveTab}
          initialHeritage={openedHeritage}
          initialFile={scanRequest?.file}
          initialCameraRequested={scanRequest?.startCamera}
          selectedRegion={selectedRegion}
          onChooseRegion={() => setRegionPickerOpen(true)}
          onUseDeviceLocation={useDeviceLocation}
          onStartScan={() => openScan()}
          onScanFile={openScan}
          collectionRequest={collectionRequest}
          onOpenCollection={openCollection}
          onOpenHeritage={openHeritage}
          onOpenAuth={(mode = 'signup') => setAuthRequest({ mode })}
        />}
        {!gate && regionPickerOpen ? <RegionPicker selectedRegion={selectedRegion} onClose={() => setRegionPickerOpen(false)}
          onSelect={(region) => {
            setSelectedRegion(region);
            try { localStorage.setItem('jeollo.region.v1', region); sessionStorage.setItem('jeollo.location-intro.v1', 'skipped'); } catch { /* optional preference */ }
            setRegionPickerOpen(false);
            moveTab('home');
          }} /> : null}
      </AppFrame>
    </CollectionProvider>
  );
}

function App() { return <AuthProvider><AppContent /></AuthProvider>; }

export default App;
