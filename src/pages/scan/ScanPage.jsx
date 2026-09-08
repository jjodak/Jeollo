import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { recognizeHeritageImage } from '../../services/recognitionService.js';
import { getHeritageContent } from '../../services/heritageContentService.js';
import { useCollection } from '../../components/CollectionProvider.jsx';
import { StampCard, StampImage } from '../../components/StampCard.jsx';
import { canvasToAnalysisDataUrl, createAnalysisImageFromUrl } from './imagePreparation.js';

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

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s6-5.3 6-11a6 6 0 0 0-12 0c0 5.7 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

const frameCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

let sharedCameraStream = null;
let sharedCameraState = 'idle';
let sharedPermissionNoticeDismissed = false;

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
  if (!script?.trim()) return 0;
  return Math.max(12, Math.ceil((script || '').replace(/\s/g, '').length / 4.4));
}

function formatRecognitionConfidence(confidence) {
  const value = Number(confidence);

  if (!Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value * 100)}% 일치`;
}

export function ScanPage({ initialHeritage, onOpenCollection }) {
  const { entries, stamps, collect } = useCollection();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const isMountedRef = useRef(false);
  const analysisSessionRef = useRef(0);
  const docentProgressTimerRef = useRef(null);
  const docentStartedAtRef = useRef(0);
  const docentStartProgressRef = useRef(0);
  const speechUtteranceRef = useRef(null);
  const speechSessionIdRef = useRef(0);
  const [cameraState, setCameraState] = useState(() =>
    getLiveCameraStream() ? 'ready' : sharedCameraState,
  );
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [heritageContent, setHeritageContent] = useState(initialHeritage ?? null);
  const [stampNotice, setStampNotice] = useState('');
  const [stampError, setStampError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisPhase, setAnalysisPhase] = useState(initialHeritage ? 'detail' : 'camera');
  const [docentProgress, setDocentProgress] = useState(0);
  const [isDocentPlaying, setIsDocentPlaying] = useState(false);
  const [showDocentScript, setShowDocentScript] = useState(false);
  const [showFullDetail, setShowFullDetail] = useState(false);
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

  const saveStamp = useCallback((content) => {
    try {
      const result = collect(content);
      setStampNotice(result.isNew ? '새로운 스탬프를 획득했어요' : '이미 획득한 스탬프예요');
      setStampError('');
    } catch (error) {
      setStampNotice('');
      setStampError(error.message);
    }
  }, [collect]);

  const finishAnalysisWithResult = useCallback(async (result, sessionId) => {
    if (!isMountedRef.current || sessionId !== analysisSessionRef.current) return;
    const content = result.match ? await getHeritageContent(result.match) : null;
    if (!isMountedRef.current || sessionId !== analysisSessionRef.current) {
      return;
    }

    setRecognitionResult(result);
    setHeritageContent(content);
    setAnalysisError(null);
    if (content) saveStamp(content);
    setAnalysisPhase('complete');
  }, [saveStamp]);

  const runRecognition = useCallback(async (imageDataUrl, sessionId) => {
    if (!isMountedRef.current || sessionId !== analysisSessionRef.current) return;
    try {
      const result = await recognizeHeritageImage({ imageDataUrl });
      await finishAnalysisWithResult(result, sessionId);
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
    setHeritageContent(null);
    setStampNotice('');
    setStampError('');
    setSpeechError('');
    setAnalysisError(null);
    setAnalysisPhase('analyzing');

    return sessionId;
  }, []);

  const handleGalleryChange = async (event) => {
    const [file] = event.target.files ?? [];

    if (!file) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setPreviewImage(imageUrl);
    const sessionId = beginAnalysis(imageUrl);
    event.target.value = '';

    try {
      const imageDataUrl = await createAnalysisImageFromUrl(imageUrl);
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
    setHeritageContent(null);
    setStampNotice('');
    setStampError('');
    setSpeechError('');
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

  const matchedHeritage = heritageContent;
  const recognitionConfidenceText = formatRecognitionConfidence(recognitionResult?.match?.confidence);
  const recognitionTitle = matchedHeritage?.name ?? '인식하지 못했어요';
  const recognitionDescription = matchedHeritage
    ? (matchedHeritage.description || `${recognitionConfidenceText ?? '인식 완료'} · 문화유산을 찾았어요`)
    : (analysisError || '등록된 문화유산과 일치하는 항목을 찾지 못했어요');
  const activeDocentTitle = matchedHeritage?.docentTitle ?? '';
  const activeDocentSubtitle = matchedHeritage?.docentSubtitle || matchedHeritage?.place || '';
  const activeDocentScript = matchedHeritage?.docentText ?? '';
  const activeDocentDuration = useMemo(() => getDocentDuration(activeDocentScript), [activeDocentScript]);
  const activeDetailImage = matchedHeritage?.detailImageUrl || matchedHeritage?.thumbnailUrl || capturedImage || '';
  const activeDetailImageAlt = matchedHeritage?.detailImageAlt || matchedHeritage?.name || '';
  const activeDetailSummary = matchedHeritage?.description || '아직 등록된 설명이 없어요.';
  const activeDetailMore = matchedHeritage?.detailText ?? '';
  const activeDetailRows = matchedHeritage?.facts ?? [];
  const activePlaceName = matchedHeritage?.place || '장소 정보 준비 중';
  const activePlaceDescription = matchedHeritage?.placeDescription ?? '';
  const collectionEntries = useMemo(() => entries.filter((entry) => matchedHeritage?.templeId
    ? entry.templeId === matchedHeritage.templeId : true), [entries, matchedHeritage?.templeId]);
  const discoveredRelicCount = collectionEntries.filter((entry) => entry.acquiredAt).length;
  const currentStamp = stamps.find((entry) => entry.id === matchedHeritage?.id);

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
      }
    }, 160);
  }, [activeDocentDuration, docentProgress]);

  const getScriptFromProgress = useCallback((progress) => {
    if (!activeDocentDuration) return '';
    const clampedProgress = Math.min(Math.max(progress, 0), activeDocentDuration);
    const startIndex = Math.floor(
      (clampedProgress / activeDocentDuration) * activeDocentScript.length,
    );

    return activeDocentScript.slice(startIndex).trim();
  }, [activeDocentDuration, activeDocentScript]);

  const playDocent = useCallback((progress = docentProgress) => {
    const startProgress = progress >= activeDocentDuration ? 0 : progress;
    const scriptFromProgress = getScriptFromProgress(startProgress);

    setDocentProgress(startProgress);

    if (!scriptFromProgress) {
      setIsDocentPlaying(false);
      return;
    }

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setSpeechError('이 브라우저에서는 음성 재생을 지원하지 않아요. 스크립트로 감상해주세요.');
      setShowDocentScript(true);
      return;
    }

    setSpeechError('');
    setIsDocentPlaying(true);
    startDocentProgressTimer(startProgress);

    const speechSessionId = speechSessionIdRef.current + 1;
    speechSessionIdRef.current = speechSessionId;
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(scriptFromProgress);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onerror = () => {
      if (speechSessionId !== speechSessionIdRef.current) return;
      clearDocentSpeech();
      setSpeechError('음성을 재생하지 못했어요. 다시 재생하거나 스크립트를 확인해주세요.');
      setShowDocentScript(true);
    };
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
  }, [activeDocentDuration, docentProgress, getScriptFromProgress, startDocentProgressTimer, clearDocentSpeech]);

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
      playDocent(nextProgress);
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
    if (initialHeritage && !capturedImage) {
      onOpenCollection(matchedHeritage?.id);
    } else {
      setAnalysisPhase('docent');
    }
  };

  const isCameraBlocked = cameraState === 'blocked';
  const isCameraUnsupported = cameraState === 'unsupported';
  const isCameraUnavailable = isCameraBlocked || isCameraUnsupported;
  const shouldShowRequestDialog = analysisPhase === 'camera' && cameraState === 'idle';
  const shouldShowPermissionDialog = analysisPhase === 'camera' && isCameraBlocked && !permissionNoticeDismissed;
  const shouldShowUnavailablePanel =
    analysisPhase === 'camera' && (isCameraUnsupported || (isCameraBlocked && permissionNoticeDismissed));
  const controlsDisabled = cameraState !== 'ready' || analysisPhase !== 'camera';
  const docentProgressPercent = activeDocentDuration ? `${(docentProgress / activeDocentDuration) * 100}%` : '0%';
  const collectionProgressPercent = `${collectionEntries.length ? (discoveredRelicCount / collectionEntries.length) * 100 : 0}%`;
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
            <button className="scan-gallery-action" type="button" onClick={() => fileInputRef.current?.click()}>
              <GalleryIcon /> 사진 불러오기
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
                  <p role="status">{stampNotice}</p>
                  {stampError ? <p role="alert">{stampError}</p> : null}
                  {stampError ? <button className="scan-analysis-secondary" type="button" onClick={() => saveStamp(matchedHeritage)}>스탬프 저장 다시 시도</button> : null}
                  <button className="scan-analysis-primary" type="button" onClick={openDocent}>
                    {activeDocentScript ? '도슨트 듣기' : '문화유산 보기'}
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
          {activeDetailImage ? <img className="scan-analysis-image" src={activeDetailImage} alt={activeDetailImageAlt} /> : null}
          <div className="scan-analysis-scrim" aria-hidden="true" />

          <div className="scan-docent-body">
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
              disabled={!activeDocentScript}
            >
              <PlayPauseIcon isPlaying={isDocentPlaying} />
            </button>
            <label className="scan-docent-range-label">
              <span>도슨트 진행률</span>
              <input
                type="range"
                disabled={!activeDocentScript}
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
              aria-expanded={showDocentScript}
              disabled={!activeDocentScript}
            >
              <ScriptIcon />
              스크립트 보기
            </button>
            <button className="scan-docent-script-toggle" type="button" onClick={openDetail}>
              <DocentFabIcon /> 더보기
            </button>
          </div>

          {!activeDocentScript ? <p className="scan-content-notice">도슨트가 아직 준비되지 않았어요.</p> : null}
          {speechError ? <p className="scan-content-notice" role="alert">{speechError}</p> : null}
          {showDocentScript ? <p className="scan-docent-script">{activeDocentScript}</p> : null}

          <section className="scan-stamp-reward" aria-label="스탬프 획득" aria-live="polite">
            <StampImage src={matchedHeritage?.stamp.imageUrl} />
            <div>
              <strong>{currentStamp ? (stampNotice || '획득한 스탬프') : recognitionResult?.match ? '스탬프 저장 대기' : '아직 획득하지 않은 스탬프예요'}</strong>
              <p>{matchedHeritage?.stamp.title}</p>
              {stampError ? <p role="alert">{stampError}</p> : null}
              <button type="button" onClick={() => currentStamp ? onOpenCollection(matchedHeritage.id) : recognitionResult?.match ? saveStamp(matchedHeritage) : resetAnalysis()}>
                {currentStamp ? '내 스탬프 보기' : recognitionResult?.match ? '스탬프 저장 다시 시도' : '문화유산 스캔하기'}
              </button>
            </div>
          </section>
          </div>
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
              <StampImage className="scan-detail-photo" src={activeDetailImage} alt={activeDetailImageAlt} />
              <div className="scan-detail-top-gradient" aria-hidden="true" />
              <button
                className="scan-detail-nav scan-detail-nav--back"
                type="button"
                aria-label={initialHeritage ? '스탬프 모음으로 돌아가기' : '도슨트로 돌아가기'}
                onClick={closeDetail}
              >
                <BackIcon />
              </button>
              <button
                className="scan-detail-nav scan-detail-nav--save"
                type="button"
                aria-label="내 스탬프 보기"
                title="내 스탬프 보기"
                onClick={() => onOpenCollection(matchedHeritage?.id)}
              >
                <DocentFabIcon />
              </button>
              <button
                className="scan-detail-headset"
                type="button"
                aria-label="도슨트로 돌아가기"
                onClick={() => setAnalysisPhase('docent')}
              >
                <HeadsetOutlineIcon />
              </button>
            </div>

            <article className="scan-detail-content">
              <header className="scan-detail-title">
                <h2>{matchedHeritage?.name}</h2>
                <p>
                  <LocationIcon />
                  {activePlaceName}
                </p>
              </header>

              <div className="scan-detail-divider" />

              <section className="scan-detail-summary" aria-label="상세 설명">
                <p>
                  {activeDetailSummary}
                  {showFullDetail ? ` ${activeDetailMore}` : ''}
                </p>
                {activeDetailMore ? <button type="button" aria-expanded={showFullDetail} onClick={() => setShowFullDetail((isVisible) => !isVisible)}>
                  {showFullDetail ? '접기' : '더보기'}
                </button> : null}
              </section>

              <div className="scan-detail-divider" />

              <section className="scan-detail-facts" aria-label="세부 사항">
                <h3>세부 사항</h3>
                <dl>
                  {activeDetailRows.map((row, index) => (
                    <div className="scan-detail-fact-row" key={`${row.label}-${index}`}>
                      <dt>
                        <span>{row.label}</span>
                      </dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
                {!activeDetailRows.length ? <p className="collection-empty-copy">세부 정보를 준비하고 있어요.</p> : null}
              </section>

              <div className="scan-detail-divider" />

              <section className="scan-detail-collection" aria-label="문화유산 스탬프 도감">
                <header>
                  <div>
                    <h3>{matchedHeritage?.place ? `${matchedHeritage.place} 도감` : '문화유산 도감'}</h3>
                    <p>{currentStamp ? '스탬프 획득 완료' : '아직 획득하지 않은 스탬프예요'}</p>
                  </div>
                  <strong>{discoveredRelicCount} / {collectionEntries.length} 발견</strong>
                </header>
                <div className="scan-detail-progress" aria-hidden="true">
                  <span style={{ width: collectionProgressPercent }} />
                </div>
                {stampError ? <button className="collection-text-action" type="button" onClick={() => saveStamp(matchedHeritage)}>스탬프 저장 다시 시도</button> : null}
                <div className="collection-stamp-list">
                  {collectionEntries.map((entry) => (
                    <StampCard key={entry.id} heritage={entry} selected={entry.id === matchedHeritage?.id}
                      onSelect={(heritage) => onOpenCollection(heritage.id)} />
                  ))}
                </div>
                <button className="collection-text-action" type="button" onClick={() => onOpenCollection(matchedHeritage?.id)}>내 스탬프 모두 보기</button>
              </section>

              <div className="scan-detail-divider" />

              <section className="scan-detail-place" aria-label="장소">
                <h3>장소</h3>
                <article>
                  <div className="scan-detail-place-image">
                    <StampImage src={activeDetailImage} />
                  </div>
                  <div className="scan-detail-place-copy">
                    <strong>{activePlaceName}</strong>
                    <p>{activePlaceDescription}</p>
                  </div>
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
              disabled={!activeDocentScript}
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
                disabled={!activeDocentScript}
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
