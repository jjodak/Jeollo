import { useCallback, useEffect, useRef, useState } from 'react';

import representativeRelicImage from '../../assets/figma/dancheong-tour.png';
import { recognizeHeritageImage } from '../../services/recognitionService.js';

function FlashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13 2 5.5 13h5L9 22l8-12h-5l1-8Z" />
      <path d="m4 5 16 14" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="5" width="14" height="14" rx="2.3" />
      <path d="m7.8 16.4 3.2-3.3 2.1 2.1 1.8-1.8 3.3 3.5" />
      <circle cx="15.8" cy="8.9" r="1.4" />
    </svg>
  );
}

function CameraPermissionIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8.8 6.5 10.2 4h3.6l1.4 2.5H18a2.5 2.5 0 0 1 2.5 2.5v7.5A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5V9A2.5 2.5 0 0 1 6 6.5h2.8Z" />
      <circle cx="12" cy="12.8" r="3.2" />
      <path d="M4 4 20 20" />
    </svg>
  );
}

function ScriptIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4.5h7.2L18 8.2V19.5H7V4.5Z" />
      <path d="M14 4.8V8.5h3.7" />
      <path d="M9.5 12h6" />
      <path d="M9.5 15h5" />
    </svg>
  );
}

function PlayPauseIcon({ isPlaying }) {
  if (isPlaying) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8.5 7v10" />
        <path d="M15.5 7v10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 7.5v9l7-4.5-7-4.5Z" />
    </svg>
  );
}

function DocentFabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="6" y="4.5" width="12" height="15" rx="2" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h4" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.2 6.3a5.1 5.1 0 0 0-7.2 0l-1 1-1-1a5.1 5.1 0 0 0-7.2 7.2l1 1L12 21.7l7.2-7.2 1-1a5.1 5.1 0 0 0 0-7.2Z" />
    </svg>
  );
}

function HeadsetOutlineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 13a7 7 0 0 1 14 0v4.2" />
      <path d="M5 13v3.5a2.5 2.5 0 0 0 2.5 2.5H9v-7H7.5A2.5 2.5 0 0 0 5 14.5" />
      <path d="M19 13v3.5a2.5 2.5 0 0 1-2.5 2.5H15v-7h1.5a2.5 2.5 0 0 1 2.5 2.5" />
      <path d="M15 19h-2.3" />
    </svg>
  );
}

function DetailMetaIcon({ type }) {
  const paths = {
    location: (
      <>
        <path d="M12 21s6-5.3 6-11a6 6 0 0 0-12 0c0 5.7 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    era: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    material: (
      <>
        <path d="M6.5 8.5 12 5l5.5 3.5v7L12 19l-5.5-3.5v-7Z" />
        <path d="m6.8 8.7 5.2 3.2 5.2-3.2" />
        <path d="M12 12v6.5" />
      </>
    ),
    size: (
      <>
        <path d="M5 6h14" />
        <path d="M5 18h14" />
        <path d="M7 4v4" />
        <path d="M17 16v4" />
      </>
    ),
    treasure: (
      <>
        <path d="M8 4h8l2 5-6 11L6 9l2-5Z" />
        <path d="M6 9h12" />
      </>
    ),
    owner: (
      <>
        <path d="M5 20V8l7-4 7 4v12" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[type]}
    </svg>
  );
}

const frameCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const DOCENT_TITLE = '부처님 있어요? 아뇨 없어요.';
const DOCENT_SUBTITLE = '사라진 불상은 어떻게 생겼을까?';
const DOCENT_SCRIPT =
  '금산사 석련대는 불상을 올려두던 돌 연꽃 받침입니다. 지금은 주인공이 사라졌지만, 정교한 연꽃 조각은 당시의 장엄한 불교 문화를 조용히 전해줍니다.';
const DETAIL_SUMMARY =
  '금산사 석련대(石蓮臺)는 전라북도 김제시 금산면 금산리 금산사 경내에 있는 석조 유물로, 1963년 보물 제23호로 지정되었습니다. 통일신라 말에서 고려 초, 9~10세기 사이에 조성된 것으로 추정됩니다.';
const DETAIL_MORE =
  '연꽃 모양의 받침은 불상을 모시던 자리로 보이며, 섬세한 조각과 안정적인 비례가 당시 석조 기술의 수준을 보여줍니다.';
const ANALYSIS_IMAGE_MAX_EDGE = 1200;
const ANALYSIS_IMAGE_QUALITY = 0.82;
const detailRows = [
  { id: 'era', icon: 'era', text: '통일신라 말 ~ 고려 초 (9~10세기)' },
  { id: 'material', icon: 'material', text: '화강암' },
  { id: 'size', icon: 'size', text: '높이 약 40cm · 지름 약 95cm' },
  { id: 'treasure', icon: 'treasure', text: '보물 제23호 · 1963년 1월 21일 지정' },
  { id: 'owner', icon: 'owner', text: '국가유산청 · 금산사 소장' },
];
const COLLECTION_TOTAL = 10;
const collectionTitles = ['석련대'];
let sharedCameraStream = null;
let sharedCameraState = 'idle';
let sharedPermissionNoticeDismissed = false;
let sharedFoundRelicCount = 0;

function getLiveCameraStream() {
  const hasLiveVideoTrack = sharedCameraStream
    ?.getVideoTracks()
    .some((track) => track.readyState === 'live');

  if (!hasLiveVideoTrack) {
    sharedCameraStream = null;

    if (sharedCameraState === 'ready') {
      sharedCameraState = 'idle';
    }
  }

  return sharedCameraStream;
}

function formatMediaTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function getDocentDuration(script) {
  return Math.max(12, Math.ceil((script || '').replace(/\s/g, '').length / 4.4));
}

function getScaledSize(width, height) {
  const scale = Math.min(1, ANALYSIS_IMAGE_MAX_EDGE / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToAnalysisDataUrl(source, width, height) {
  const targetSize = getScaledSize(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = targetSize.width;
  canvas.height = targetSize.height;

  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.drawImage(source, 0, 0, targetSize.width, targetSize.height);

  return canvas.toDataURL('image/jpeg', ANALYSIS_IMAGE_QUALITY);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 분석 가능한 형식으로 읽지 못했어요.'));
    image.src = dataUrl;
  });
}

async function createAnalysisImageFromFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  const analysisImage = canvasToAnalysisDataUrl(image, image.naturalWidth, image.naturalHeight);

  if (!analysisImage) {
    throw new Error('이미지 변환에 실패했어요.');
  }

  return analysisImage;
}

function formatRecognitionConfidence(confidence) {
  const value = Number(confidence);

  if (!Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value * 100)}% 일치`;
}

export function ScanPage() {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const isMountedRef = useRef(false);
  const analysisSessionRef = useRef(0);
  const docentProgressTimerRef = useRef(null);
  const docentStartedAtRef = useRef(0);
  const docentStartProgressRef = useRef(0);
  const speechUtteranceRef = useRef(null);
  const speechSessionIdRef = useRef(0);
  const hasCountedCurrentScanRef = useRef(false);
  const [cameraState, setCameraState] = useState(() =>
    getLiveCameraStream() ? 'ready' : sharedCameraState,
  );
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisPhase, setAnalysisPhase] = useState('camera');
  const [docentProgress, setDocentProgress] = useState(0);
  const [isDocentPlaying, setIsDocentPlaying] = useState(false);
  const [showDocentScript, setShowDocentScript] = useState(false);
  const [showFullDetail, setShowFullDetail] = useState(false);
  const [foundRelicCount, setFoundRelicCount] = useState(() => sharedFoundRelicCount);
  const [permissionNoticeDismissed, setPermissionNoticeDismissed] = useState(
    () => sharedPermissionNoticeDismissed,
  );

  const setPersistedCameraState = useCallback((nextState) => {
    sharedCameraState = nextState;
    setCameraState(nextState);
  }, []);

  const detachCamera = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attachCamera = useCallback(async (stream) => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
    await videoRef.current.play().catch(() => undefined);
  }, []);

  const clearDocentSpeech = useCallback(() => {
    speechSessionIdRef.current += 1;
    window.clearInterval(docentProgressTimerRef.current);
    docentProgressTimerRef.current = null;
    setIsDocentPlaying(false);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    speechUtteranceRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    const liveStream = getLiveCameraStream();
    sharedPermissionNoticeDismissed = false;
    setPermissionNoticeDismissed(false);

    if (liveStream) {
      setPersistedCameraState('ready');
      await attachCamera(liveStream);
      return;
    }

    setPersistedCameraState('loading');

    if (!navigator.mediaDevices?.getUserMedia) {
      if (isMountedRef.current) {
        setPersistedCameraState('unsupported');
      }

      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      sharedCameraStream = stream;
      await attachCamera(stream);

      setPersistedCameraState('ready');
    } catch {
      if (isMountedRef.current) {
        setPersistedCameraState('blocked');
      }
    }
  }, [attachCamera, setPersistedCameraState]);

  useEffect(() => {
    isMountedRef.current = true;

    const liveStream = getLiveCameraStream();

    if (liveStream) {
      setPersistedCameraState('ready');
      attachCamera(liveStream);
    }

    return () => {
      isMountedRef.current = false;
      analysisSessionRef.current += 1;
      clearDocentSpeech();
      detachCamera();
    };
  }, [attachCamera, clearDocentSpeech, detachCamera, setPersistedCameraState]);

  useEffect(() => {
    if (cameraState !== 'ready') {
      setFlashEnabled(false);
    }
  }, [cameraState]);

  useEffect(() => {
    return () => {
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  const toggleFlash = async () => {
    const nextValue = !flashEnabled;
    setFlashEnabled(nextValue);

    const [track] = getLiveCameraStream()?.getVideoTracks() ?? [];
    const capabilities = track?.getCapabilities?.();

    if (capabilities?.torch) {
      await track.applyConstraints({ advanced: [{ torch: nextValue }] }).catch(() => undefined);
    }
  };

  const finishAnalysisWithError = useCallback((error, sessionId) => {
    if (!isMountedRef.current || sessionId !== analysisSessionRef.current) {
      return;
    }

    setRecognitionResult(null);
    setAnalysisError(error instanceof Error ? error.message : '이미지 분석에 실패했어요.');
    setAnalysisPhase('complete');
  }, []);

  const finishAnalysisWithResult = useCallback((result, sessionId) => {
    if (!isMountedRef.current || sessionId !== analysisSessionRef.current) {
      return;
    }

    setRecognitionResult(result);
    setAnalysisError(null);

    if (result.match && !hasCountedCurrentScanRef.current) {
      hasCountedCurrentScanRef.current = true;
      sharedFoundRelicCount = Math.min(COLLECTION_TOTAL, sharedFoundRelicCount + 1);
      setFoundRelicCount(sharedFoundRelicCount);
    }

    setAnalysisPhase('complete');
  }, []);

  const runRecognition = useCallback(async (imageDataUrl, sessionId) => {
    try {
      const result = await recognizeHeritageImage({ imageDataUrl });
      finishAnalysisWithResult(result, sessionId);
    } catch (error) {
      finishAnalysisWithError(error, sessionId);
    }
  }, [finishAnalysisWithError, finishAnalysisWithResult]);

  const beginAnalysis = useCallback((displayImage) => {
    analysisSessionRef.current += 1;
    const sessionId = analysisSessionRef.current;

    setCapturedImage(displayImage);
    setFlashEnabled(false);
    setRecognitionResult(null);
    setAnalysisError(null);
    setAnalysisPhase('analyzing');
    hasCountedCurrentScanRef.current = false;

    return sessionId;
  }, []);

  const handleGalleryChange = async (event) => {
    const [file] = event.target.files ?? [];

    if (!file) {
      return;
    }

    if (previewImage) {
      URL.revokeObjectURL(previewImage);
    }

    const imageUrl = URL.createObjectURL(file);
    setPreviewImage(imageUrl);
    const sessionId = beginAnalysis(imageUrl);
    event.target.value = '';

    try {
      const imageDataUrl = await createAnalysisImageFromFile(file);
      runRecognition(imageDataUrl, sessionId);
    } catch (error) {
      finishAnalysisWithError(error, sessionId);
    }
  };

  const resetAnalysis = () => {
    analysisSessionRef.current += 1;
    clearDocentSpeech();
    setPreviewImage(null);
    setCapturedImage(null);
    setRecognitionResult(null);
    setAnalysisError(null);
    setAnalysisPhase('camera');
    setDocentProgress(0);
    setShowDocentScript(false);
    setShowFullDetail(false);
  };

  const captureCurrentFrame = () => {
    if (previewImage) {
      return previewImage;
    }

    const video = videoRef.current;

    if (!video) {
      return null;
    }

    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;

    if (!width || !height) {
      return null;
    }

    return canvasToAnalysisDataUrl(video, width, height);
  };

  const handleCapture = () => {
    const image = captureCurrentFrame();

    if (!image) {
      return;
    }

    const sessionId = beginAnalysis(image);
    runRecognition(image, sessionId);
  };

  const matchedHeritage = recognitionResult?.match ?? null;
  const recognitionConfidenceText = formatRecognitionConfidence(matchedHeritage?.confidence);
  const recognitionTitle = matchedHeritage?.name ?? '인식하지 못했어요';
  const recognitionDescription = matchedHeritage
    ? `${recognitionConfidenceText ?? '인식 완료'} · 테스트 항목을 찾았어요`
    : (analysisError || '등록된 테스트 이미지와 일치하는 항목을 찾지 못했어요');
  const activeDocentTitle = matchedHeritage?.name ?? DOCENT_TITLE;
  const activeDocentSubtitle =
    matchedHeritage?.reason ?? matchedHeritage?.description ?? DOCENT_SUBTITLE;
  const activeDocentScript =
    matchedHeritage?.docentText || matchedHeritage?.description || DOCENT_SCRIPT;
  const activeDocentDuration = getDocentDuration(activeDocentScript);
  const activeDetailImage = matchedHeritage?.thumbnailUrl || capturedImage || representativeRelicImage;
  const activeDetailSummary = matchedHeritage?.description || DETAIL_SUMMARY;
  const activeDetailMore = matchedHeritage?.docentText || DETAIL_MORE;
  const activeDetailRows = matchedHeritage
    ? [
        {
          id: 'confidence',
          label: '일치도',
          icon: 'treasure',
          text: recognitionConfidenceText ?? '확인 완료',
        },
        {
          id: 'references',
          label: '참조',
          icon: 'material',
          text: `테스트 이미지 ${matchedHeritage.images?.length ?? 0}장`,
        },
        {
          id: 'source',
          label: '데이터',
          icon: 'owner',
          text: 'Supabase 테스트 DB',
        },
      ]
    : detailRows;
  const activeCollectionTitles = matchedHeritage ? [matchedHeritage.name] : collectionTitles;
  const activeCollectionImage = matchedHeritage?.thumbnailUrl || representativeRelicImage;
  const activePlaceName = matchedHeritage ? '테스트 이미지 세트' : '김제 금산사';
  const activePlaceDescription = matchedHeritage
    ? '지갑, 에어팟, 노트북 인식 검증을 위한 임시 데이터입니다.'
    : '미륵신앙의 중심지로 오래 사랑받아온 사찰입니다.';

  const startDocentProgressTimer = useCallback((startProgress = docentProgress) => {
    window.clearInterval(docentProgressTimerRef.current);
    docentStartedAtRef.current = performance.now();
    docentStartProgressRef.current = startProgress;
    docentProgressTimerRef.current = window.setInterval(() => {
      const elapsedSeconds = (performance.now() - docentStartedAtRef.current) / 1000;
      const nextProgress = Math.min(
        activeDocentDuration,
        docentStartProgressRef.current + elapsedSeconds,
      );

      setDocentProgress(nextProgress);

      if (nextProgress >= activeDocentDuration) {
        window.clearInterval(docentProgressTimerRef.current);
        docentProgressTimerRef.current = null;
        setIsDocentPlaying(false);
      }
    }, 160);
  }, [activeDocentDuration, docentProgress]);

  const getScriptFromProgress = useCallback((progress) => {
    const clampedProgress = Math.min(Math.max(progress, 0), activeDocentDuration);
    const startIndex = Math.floor(
      (clampedProgress / activeDocentDuration) * activeDocentScript.length,
    );

    return activeDocentScript.slice(startIndex).trim();
  }, [activeDocentDuration, activeDocentScript]);

  const playDocent = useCallback(() => {
    const startProgress = docentProgress >= activeDocentDuration ? 0 : docentProgress;
    const scriptFromProgress = getScriptFromProgress(startProgress);

    setDocentProgress(startProgress);

    if (!scriptFromProgress) {
      setIsDocentPlaying(false);
      return;
    }

    setIsDocentPlaying(true);
    startDocentProgressTimer(startProgress);

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return;
    }

    window.speechSynthesis.cancel();

    const speechSessionId = speechSessionIdRef.current + 1;
    speechSessionIdRef.current = speechSessionId;

    const utterance = new window.SpeechSynthesisUtterance(scriptFromProgress);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (speechSessionId !== speechSessionIdRef.current) {
        return;
      }

      setDocentProgress(activeDocentDuration);
      setIsDocentPlaying(false);
      window.clearInterval(docentProgressTimerRef.current);
      docentProgressTimerRef.current = null;
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [activeDocentDuration, docentProgress, getScriptFromProgress, startDocentProgressTimer]);

  const pauseDocent = useCallback((cancelSpeech = false) => {
    setIsDocentPlaying(false);
    window.clearInterval(docentProgressTimerRef.current);
    docentProgressTimerRef.current = null;

    if (window.speechSynthesis) {
      if (cancelSpeech) {
        speechSessionIdRef.current += 1;
        window.speechSynthesis.cancel();
        speechUtteranceRef.current = null;
        return;
      }

      window.speechSynthesis.pause();
    }
  }, []);

  const toggleDocentPlayback = useCallback(() => {
    if (isDocentPlaying) {
      pauseDocent();
      return;
    }

    if (window.speechSynthesis?.paused && speechUtteranceRef.current) {
      window.speechSynthesis.resume();
      setIsDocentPlaying(true);
      startDocentProgressTimer();
      return;
    }

    playDocent();
  }, [isDocentPlaying, pauseDocent, playDocent, startDocentProgressTimer]);

  const handleDocentSeek = (event) => {
    const nextProgress = Number(event.target.value);
    setDocentProgress(nextProgress);

    if (nextProgress >= activeDocentDuration) {
      pauseDocent(true);
      return;
    }

    if (isDocentPlaying) {
      pauseDocent(true);
      window.requestAnimationFrame(() => {
        if (isMountedRef.current) {
          const scriptFromProgress = getScriptFromProgress(nextProgress);

          if (!scriptFromProgress) {
            return;
          }

          setIsDocentPlaying(true);
          startDocentProgressTimer(nextProgress);

          if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            return;
          }

          const speechSessionId = speechSessionIdRef.current + 1;
          speechSessionIdRef.current = speechSessionId;
          const utterance = new window.SpeechSynthesisUtterance(scriptFromProgress);
          utterance.lang = 'ko-KR';
          utterance.rate = 0.92;
          utterance.pitch = 1;
          utterance.onend = () => {
            if (speechSessionId !== speechSessionIdRef.current) {
              return;
            }

            setDocentProgress(activeDocentDuration);
            setIsDocentPlaying(false);
            window.clearInterval(docentProgressTimerRef.current);
            docentProgressTimerRef.current = null;
          };

          speechUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        }
      });
    } else if (speechUtteranceRef.current) {
      pauseDocent(true);
    }
  };

  const openDocent = () => {
    clearDocentSpeech();
    setDocentProgress(0);
    setShowDocentScript(false);
    setShowFullDetail(false);
    setAnalysisPhase('docent');
  };

  const openDetail = () => {
    setShowDocentScript(false);
    setShowFullDetail(false);
    setAnalysisPhase('detail');
  };

  const closeDetail = () => {
    setAnalysisPhase('docent');
  };

  const isCameraBlocked = cameraState === 'blocked';
  const isCameraUnsupported = cameraState === 'unsupported';
  const isCameraUnavailable = isCameraBlocked || isCameraUnsupported;
  const shouldShowRequestDialog = cameraState === 'idle';
  const shouldShowPermissionDialog = isCameraBlocked && !permissionNoticeDismissed;
  const shouldShowUnavailablePanel =
    isCameraUnsupported || (isCameraBlocked && permissionNoticeDismissed);
  const controlsDisabled = cameraState !== 'ready' || analysisPhase !== 'camera';
  const docentProgressPercent = `${(docentProgress / activeDocentDuration) * 100}%`;
  const discoveredRelicCount = Math.min(foundRelicCount, COLLECTION_TOTAL);
  const collectionProgressPercent = `${(discoveredRelicCount / COLLECTION_TOTAL) * 100}%`;
  const scanResultImage = capturedImage;
  const unavailableMessage = isCameraUnsupported
    ? '현재 브라우저에서는 카메라 스캔을 사용할 수 없어요.'
    : '권한 요청창이 다시 뜨지 않으면 주소창의 카메라 설정에서 허용으로 바꿔주세요.';

  return (
    <section
      className={`scan-page scan-page--${cameraState} scan-page--${analysisPhase}`}
      data-node-id="8:812"
      data-name="iPhone 16 - 2"
      aria-label="문화유산 스캔"
    >
      <video
        ref={videoRef}
        className="scan-camera-feed"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />

      {previewImage ? (
        <img className="scan-gallery-preview" src={previewImage} alt="" aria-hidden="true" />
      ) : null}

      <div className="scan-camera-fallback" aria-hidden="true" />
      <div className="scan-camera-dim" aria-hidden="true" />

      <p className="scan-instruction">문화유산의 모습을 찍어보세요</p>

      {shouldShowRequestDialog ? (
        <div className="scan-permission-layer" role="presentation">
          <section
            className="scan-permission-dialog"
            role="dialog"
            aria-labelledby="scan-request-title"
            aria-describedby="scan-request-description"
          >
            <span className="scan-permission-icon">
              <CameraPermissionIcon />
            </span>
            <h2 id="scan-request-title">카메라 권한을 허용해주세요</h2>
            <p id="scan-request-description">
              스캔을 시작하려면 카메라 접근 권한이 필요해요. 아래 버튼을 누르면
              브라우저 권한 요청창이 열립니다.
            </p>
            <button className="scan-permission-action" type="button" onClick={startCamera}>
              카메라 권한 요청
            </button>
          </section>
        </div>
      ) : null}

      {shouldShowPermissionDialog ? (
        <div className="scan-permission-layer" role="presentation">
          <section
            className="scan-permission-dialog"
            role="dialog"
            aria-labelledby="scan-permission-title"
            aria-describedby="scan-permission-description"
          >
            <button
              className="scan-permission-close"
              type="button"
              aria-label="권한 안내 닫기"
              onClick={() => {
                sharedPermissionNoticeDismissed = true;
                setPermissionNoticeDismissed(true);
              }}
            >
              X
            </button>
            <span className="scan-permission-icon">
              <CameraPermissionIcon />
            </span>
            <h2 id="scan-permission-title">카메라 권한이 필요해요</h2>
            <p id="scan-permission-description">
              문화유산을 스캔하려면 브라우저의 카메라 접근을 허용해주세요. 권한을
              차단한 경우 브라우저 설정에서 허용으로 바꿔야 해요.
            </p>
            <button className="scan-permission-action" type="button" onClick={startCamera}>
              권한 요청 다시 하기
            </button>
          </section>
        </div>
      ) : null}

      {shouldShowUnavailablePanel ? (
        <section className="scan-unavailable-panel" aria-live="polite">
          <h2>카메라 사용 불가</h2>
          <p>{unavailableMessage}</p>
          {isCameraBlocked ? (
            <button type="button" onClick={startCamera}>
              권한 요청 다시 하기
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="scan-focus-frame" aria-hidden="true">
        {frameCorners.map((corner) => (
          <span className={`scan-focus-corner scan-focus-corner--${corner}`} key={corner} />
        ))}
      </div>

      <div className="scan-controls">
        <button
          className={flashEnabled ? 'scan-control scan-control--active' : 'scan-control'}
          type="button"
          aria-label="플래시 토글"
          aria-pressed={flashEnabled}
          onClick={toggleFlash}
          disabled={controlsDisabled}
        >
          <FlashIcon />
        </button>

        <button
          className="scan-shutter"
          type="button"
          aria-label="촬영"
          onClick={handleCapture}
          disabled={controlsDisabled}
        />

        <button
          className="scan-control"
          type="button"
          aria-label="갤러리에서 불러오기"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCameraUnavailable}
        >
          <GalleryIcon />
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="scan-gallery-input"
        type="file"
        accept="image/*"
        onChange={handleGalleryChange}
      />

      {capturedImage && (analysisPhase === 'analyzing' || analysisPhase === 'complete') ? (
        <section
          className="scan-analysis-stage"
          data-node-id="8:235"
          data-name="iPhone 16 - 3"
          aria-live="polite"
        >
          <img className="scan-analysis-image" src={scanResultImage} alt="" />
          <div className="scan-analysis-scrim" aria-hidden="true" />

          <div className="scan-analysis-copy">
            {analysisPhase === 'analyzing' ? (
              <>
                <h2>부처님께 물어보는 중...</h2>
                <p>문화유산을 인식하고 있어요</p>
              </>
            ) : (
              <>
                <h2>{recognitionTitle}</h2>
                <p>{recognitionDescription}</p>
              </>
            )}
          </div>

          <div className="scan-analysis-actions">
            {analysisPhase === 'analyzing' ? (
              <>
                <div className="scan-analysis-loading-pill">
                  <span aria-hidden="true" />
                  <strong>분석 중...</strong>
                </div>
                <p>잠시만 기다려주세요</p>
              </>
            ) : (
              matchedHeritage ? (
                <>
                  <button className="scan-analysis-primary" type="button" onClick={openDocent}>
                    도슨트 듣기
                  </button>
                  <button className="scan-analysis-secondary" type="button" onClick={resetAnalysis}>
                    다음에 볼게요
                  </button>
                </>
              ) : (
                <button className="scan-analysis-primary" type="button" onClick={resetAnalysis}>
                  다시 찍기
                </button>
              )
            )}
          </div>
        </section>
      ) : null}

      {analysisPhase === 'docent' ? (
        <section
          className="scan-docent-stage"
          data-node-id="8:400"
          data-name="iPhone 16 - 16"
          aria-label="도슨트 재생"
        >
          {capturedImage ? <img className="scan-analysis-image" src={capturedImage} alt="" /> : null}
          <div className="scan-analysis-scrim" aria-hidden="true" />

          <header className="scan-docent-header">
            <h2>{activeDocentTitle}</h2>
            <p>{activeDocentSubtitle}</p>
          </header>

          <div className="scan-docent-player">
            <button
              className="scan-docent-play"
              type="button"
              aria-label={isDocentPlaying ? '도슨트 일시정지' : '도슨트 재생'}
              onClick={toggleDocentPlayback}
            >
              <PlayPauseIcon isPlaying={isDocentPlaying} />
            </button>
            <label className="scan-docent-range-label">
              <span>도슨트 진행률</span>
              <input
                type="range"
                min="0"
                max={activeDocentDuration}
                step="1"
                value={Math.min(docentProgress, activeDocentDuration)}
                onChange={handleDocentSeek}
                style={{ '--progress': docentProgressPercent }}
              />
            </label>
            <span className="scan-docent-time">
              {formatMediaTime(docentProgress)} / {formatMediaTime(activeDocentDuration)}
            </span>
          </div>

          <div className="scan-docent-links">
            <button
              className="scan-docent-script-toggle"
              type="button"
              onClick={() => setShowDocentScript((isVisible) => !isVisible)}
            >
              <ScriptIcon />
              스크립트 보기
            </button>
          </div>

          {showDocentScript ? <p className="scan-docent-script">{activeDocentScript}</p> : null}

          <button className="scan-docent-retake" type="button" onClick={resetAnalysis}>
            다시 찍기
          </button>

          <button
            className="scan-docent-floating"
            type="button"
            aria-label="상세 정보"
            onClick={openDetail}
          >
            <DocentFabIcon />
          </button>
        </section>
      ) : null}

      {analysisPhase === 'detail' ? (
        <section
          className="scan-detail-stage"
          data-node-id="13:887"
          data-name="iPhone 16 - 23"
          aria-label="문화유산 상세 정보"
        >
          <div className="scan-detail-scroll">
            <div className="scan-detail-hero">
              <img src={activeDetailImage} alt="" />
              <div className="scan-detail-top-gradient" aria-hidden="true" />
              <button
                className="scan-detail-nav scan-detail-nav--back"
                type="button"
                aria-label="도슨트로 돌아가기"
                onClick={closeDetail}
              >
                <BackIcon />
              </button>
              <button
                className="scan-detail-nav scan-detail-nav--save"
                type="button"
                aria-label="보관하기"
              >
                <HeartIcon />
              </button>
              <button
                className="scan-detail-headset"
                type="button"
                aria-label="도슨트로 돌아가기"
                onClick={closeDetail}
              >
                <HeadsetOutlineIcon />
              </button>
            </div>

            <article className="scan-detail-content">
              <header className="scan-detail-title">
                <h2>{activeDocentTitle}</h2>
                <p>
                  <DetailMetaIcon type="location" />
                  {activePlaceName}
                </p>
              </header>

              <div className="scan-detail-divider" />

              <section className="scan-detail-summary" aria-label="상세 설명">
                <p>
                  {activeDetailSummary}
                  {showFullDetail ? ` ${activeDetailMore}` : ''}
                </p>
                <button type="button" onClick={() => setShowFullDetail((isVisible) => !isVisible)}>
                  {showFullDetail ? '접기' : '더보기'}
                </button>
              </section>

              <div className="scan-detail-divider" />

              <section className="scan-detail-facts" aria-label="세부 사항">
                <h3>세부 사항</h3>
                <dl>
                  {activeDetailRows.map((row) => (
                    <div className="scan-detail-fact-row" key={row.id}>
                      <dt>
                        <DetailMetaIcon type={row.icon} />
                        <span>{row.label ?? row.id}</span>
                      </dt>
                      <dd>{row.text}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <div className="scan-detail-divider" />

              <section className="scan-detail-collection" aria-label="테스트 문화유산 도감">
                <header>
                  <div>
                    <h3>테스트 문화유산 도감</h3>
                    <p>직접 문화유산을 스캔하며 새로운 유물을 발견해보세요</p>
                  </div>
                  <strong>{discoveredRelicCount} / {COLLECTION_TOTAL} 발견</strong>
                </header>
                <div className="scan-detail-progress" aria-hidden="true">
                  <span style={{ width: collectionProgressPercent }} />
                </div>
                <div className="scan-detail-relic-list">
                  {Array.from({ length: COLLECTION_TOTAL }, (_, index) => {
                    const relicNumber = index + 1;
                    const isFound = relicNumber <= discoveredRelicCount;
                    const title = activeCollectionTitles[index] ?? `발견 유물 ${relicNumber}`;

                    return (
                      <article
                        className={
                          isFound
                            ? 'scan-detail-relic-card scan-detail-relic-card--found'
                            : 'scan-detail-relic-card'
                        }
                        key={relicNumber}
                      >
                        <div
                          className={
                            isFound ? 'scan-detail-relic-image' : 'scan-detail-relic-placeholder'
                          }
                          aria-hidden={!isFound}
                        >
                          {isFound ? <img src={activeCollectionImage} alt="" /> : null}
                        </div>
                        <footer>
                          <span>No.{String(relicNumber).padStart(2, '0')}</span>
                          <strong>{isFound ? title : '???'}</strong>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="scan-detail-divider" />

              <section className="scan-detail-place" aria-label="장소">
                <h3>장소</h3>
                <article>
                  <div className="scan-detail-place-image">
                    <img src={activeDetailImage} alt="" />
                  </div>
                  <div className="scan-detail-place-copy">
                    <strong>{activePlaceName}</strong>
                    <span>자세한 정보</span>
                    <p>{activePlaceDescription}</p>
                  </div>
                  <span className="scan-detail-place-pill">더 찾아보기 +1</span>
                </article>
              </section>
            </article>
          </div>

          <aside className="scan-detail-mini-player" aria-label="도슨트 미니 플레이어">
            <button
              className="scan-detail-mini-toggle"
              type="button"
              aria-label={isDocentPlaying ? '도슨트 일시정지' : '도슨트 재생'}
              onClick={toggleDocentPlayback}
            >
              <PlayPauseIcon isPlaying={isDocentPlaying} />
            </button>
            <div className="scan-detail-mini-copy">
              <strong>{activeDocentTitle}</strong>
              <span>{activeDocentSubtitle}</span>
            </div>
            <label className="scan-detail-mini-range-label">
              <span>도슨트 진행률</span>
              <input
                type="range"
                min="0"
                max={activeDocentDuration}
                step="1"
                value={Math.min(docentProgress, activeDocentDuration)}
                onChange={handleDocentSeek}
                style={{ '--progress': docentProgressPercent }}
              />
            </label>
            <span className="scan-detail-mini-time">
              {formatMediaTime(docentProgress)} / {formatMediaTime(activeDocentDuration)}
            </span>
          </aside>
        </section>
      ) : null}
    </section>
  );
}
