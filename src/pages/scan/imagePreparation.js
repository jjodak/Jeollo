const ANALYSIS_IMAGE_MAX_EDGE = 1200;
const ANALYSIS_IMAGE_QUALITY = 0.82;

function getScaledSize(width, height) {
  const scale = Math.min(1, ANALYSIS_IMAGE_MAX_EDGE / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function canvasToAnalysisDataUrl(source, width, height) {
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 분석 가능한 형식으로 읽지 못했어요.'));
    image.src = url;
  });
}

export async function createAnalysisImageFromUrl(url) {
  const image = await loadImage(url);
  const analysisImage = canvasToAnalysisDataUrl(image, image.naturalWidth, image.naturalHeight);

  if (!analysisImage) {
    throw new Error('이미지 변환에 실패했어요.');
  }

  return analysisImage;
}
