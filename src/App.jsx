import { useState } from 'react';
import { AppFrame } from './components/AppFrame.jsx';
import { BottomTabs } from './components/BottomTabs.jsx';
import { HomePage } from './pages/home/HomePage.jsx';
import { ScanPage } from './pages/scan/ScanPage.jsx';
import { SearchPage } from './pages/search/SearchPage.jsx';

const tabs = [
  {
    id: 'home',
    label: '홈',
    title: '오늘은 어느 절로 떠나볼까요?',
    description: '위치 기반 사찰 추천과 주요 콘텐츠를 확인하는 시작 화면',
    immersive: true,
    component: HomePage,
  },
  {
    id: 'scan',
    label: '스캔',
    title: '문화유산을 스캔하세요',
    description: '카메라로 문화유산을 인식하고 도슨트로 연결하는 화면',
    immersive: true,
    component: ScanPage,
  },
  {
    id: 'search',
    label: '탐색',
    title: '절로 떠나는 발견의 시간',
    description: '사찰, 문화유산, 행사, 테마 투어를 찾아보는 화면',
    immersive: true,
    component: SearchPage,
  },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('home');
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const ActivePage = activeTab.component;

  return (
    <AppFrame
      activeTab={activeTab}
      bottomNavigation={
        <BottomTabs tabs={tabs} activeTabId={activeTabId} onChange={setActiveTabId} />
      }
    >
      <ActivePage onMoveTab={setActiveTabId} />
    </AppFrame>
  );
}

export default App;
