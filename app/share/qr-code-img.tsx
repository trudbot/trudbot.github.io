import { useEffect, useRef, useState } from "react";
import {
  CenterImage,
  LocatorStyle,
  ModuleStyle,
  QuietZone,
  generateQRCode,
  initialize,
} from "@chromium-style-qrcode/generator";

const MODULE_COLOR = "#000000";
const BACKGROUND_COLOR = "#ffffff";
const QR_MAX_DISPLAY_SIZE_PX = 320;
const MODULE_SIZE_PIXELS = 10;
const DINO_TILE_SIZE_PIXELS = 4;
const LOCATOR_SIZE_MODULES = 7;
const DINO_WIDTH = 20;
const DINO_HEIGHT = 22;
const DINO_HEAD_HEIGHT = 8;
const DINO_BODY_HEIGHT = 14;
const DINO_WIDTH_BYTES = 3;

const DINO_HEAD_RIGHT = [
  0b00000000, 0b00011111, 0b11100000, 0b00000000, 0b00111111, 0b11110000, 0b00000000, 0b00110111,
  0b11110000, 0b00000000, 0b00111111, 0b11110000, 0b00000000, 0b00111111, 0b11110000, 0b00000000,
  0b00111111, 0b11110000, 0b00000000, 0b00111110, 0b00000000, 0b00000000, 0b00111111, 0b11000000,
];

const DINO_BODY = [
  0b10000000, 0b01111100, 0b00000000, 0b10000001, 0b11111100, 0b00000000, 0b11000011, 0b11111111,
  0b00000000, 0b11100111, 0b11111101, 0b00000000, 0b11111111, 0b11111100, 0b00000000, 0b11111111,
  0b11111100, 0b00000000, 0b01111111, 0b11111000, 0b00000000, 0b00111111, 0b11111000, 0b00000000,
  0b00011111, 0b11110000, 0b00000000, 0b00001111, 0b11100000, 0b00000000, 0b00000111, 0b01100000,
  0b00000000, 0b00000110, 0b00100000, 0b00000000, 0b00000100, 0b00100000, 0b00000000, 0b00000110,
  0b00110000, 0b00000000,
];

function isLocatorModule(x: number, y: number, originalSize: number) {
  return (
    (x < LOCATOR_SIZE_MODULES && y < LOCATOR_SIZE_MODULES) ||
    (x >= originalSize - LOCATOR_SIZE_MODULES && y < LOCATOR_SIZE_MODULES) ||
    (x < LOCATOR_SIZE_MODULES && y >= originalSize - LOCATOR_SIZE_MODULES)
  );
}

function drawRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawLocators(
  context: CanvasRenderingContext2D,
  originalSize: number,
  margin: number,
  modulePixelSize: number,
) {
  const scaleFactor = modulePixelSize / MODULE_SIZE_PIXELS;
  const radius = MODULE_SIZE_PIXELS * scaleFactor;

  function drawOneLocator(leftXModules: number, topYModules: number) {
    let leftXPixels = leftXModules * modulePixelSize;
    let topYPixels = topYModules * modulePixelSize;
    let dimPixels = modulePixelSize * LOCATOR_SIZE_MODULES;

    drawRoundRect(
      context,
      margin + leftXPixels,
      margin + topYPixels,
      dimPixels,
      dimPixels,
      radius,
      MODULE_COLOR,
    );

    leftXPixels += modulePixelSize;
    topYPixels += modulePixelSize;
    dimPixels -= 2 * modulePixelSize;
    drawRoundRect(
      context,
      margin + leftXPixels,
      margin + topYPixels,
      dimPixels,
      dimPixels,
      radius,
      BACKGROUND_COLOR,
    );

    leftXPixels += modulePixelSize;
    topYPixels += modulePixelSize;
    dimPixels -= 2 * modulePixelSize;
    drawRoundRect(
      context,
      margin + leftXPixels,
      margin + topYPixels,
      dimPixels,
      dimPixels,
      radius,
      MODULE_COLOR,
    );
  }

  drawOneLocator(0, 0);
  drawOneLocator(originalSize - LOCATOR_SIZE_MODULES, 0);
  drawOneLocator(0, originalSize - LOCATOR_SIZE_MODULES);
}

function drawDinoPixelData(
  context: CanvasRenderingContext2D,
  srcArray: number[],
  srcNumRows: number,
  startRow: number,
  destX: number,
  destY: number,
  scaleX: number,
  scaleY: number,
) {
  for (let row = 0; row < srcNumRows; row += 1) {
    let whichByte = row * DINO_WIDTH_BYTES;
    let mask = 0b10000000;

    for (let col = 0; col < DINO_WIDTH; col += 1) {
      if (srcArray[whichByte] & mask) {
        const pixelX = destX + col * scaleX;
        const pixelY = destY + (startRow + row) * scaleY;
        context.fillRect(
          Math.floor(pixelX),
          Math.floor(pixelY),
          Math.ceil(scaleX),
          Math.ceil(scaleY),
        );
      }

      mask >>= 1;
      if (mask === 0) {
        mask = 0b10000000;
        whichByte += 1;
      }
    }
  }
}

function drawCenterImage(
  context: CanvasRenderingContext2D,
  canvasSize: number,
  modulePixelSize: number,
) {
  const scaleFactor = modulePixelSize / MODULE_SIZE_PIXELS;
  const pixelsPerDinoTile = Math.round(DINO_TILE_SIZE_PIXELS * scaleFactor);
  const dinoWidthPx = pixelsPerDinoTile * DINO_WIDTH;
  const dinoHeightPx = pixelsPerDinoTile * DINO_HEIGHT;
  const dinoBorderPx = Math.round(2 * scaleFactor);

  if (canvasSize / 2 < dinoWidthPx + dinoBorderPx || canvasSize / 2 < dinoHeightPx + dinoBorderPx)
    return;

  let destX = (canvasSize - dinoWidthPx) / 2;
  let destY = (canvasSize - dinoHeightPx) / 2;
  const backgroundLeft = Math.floor((destX - dinoBorderPx) / modulePixelSize) * modulePixelSize;
  const backgroundTop = Math.floor((destY - dinoBorderPx) / modulePixelSize) * modulePixelSize;
  const backgroundRight =
    Math.floor((destX + dinoWidthPx + dinoBorderPx + modulePixelSize - 1) / modulePixelSize) *
    modulePixelSize;
  const backgroundBottom =
    Math.floor((destY + dinoHeightPx + dinoBorderPx + modulePixelSize - 1) / modulePixelSize) *
    modulePixelSize;

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(
    backgroundLeft,
    backgroundTop,
    backgroundRight - backgroundLeft,
    backgroundBottom - backgroundTop,
  );

  destX += Math.round((backgroundLeft + backgroundRight) / 2 - (destX + dinoWidthPx / 2));
  destY += Math.round((backgroundTop + backgroundBottom) / 2 - (destY + dinoHeightPx / 2));

  context.fillStyle = MODULE_COLOR;
  const scaleX = dinoWidthPx / DINO_WIDTH;
  const scaleY = dinoHeightPx / DINO_HEIGHT;
  drawDinoPixelData(context, DINO_HEAD_RIGHT, DINO_HEAD_HEIGHT, 0, destX, destY, scaleX, scaleY);
  drawDinoPixelData(
    context,
    DINO_BODY,
    DINO_BODY_HEIGHT,
    DINO_HEAD_HEIGHT,
    destX,
    destY,
    scaleX,
    scaleY,
  );
}

function renderQRCodeChromiumStyle(
  context: CanvasRenderingContext2D,
  pixelData: Uint8Array,
  size: number,
  originalSize: number,
) {
  const hasQuietZone = size > originalSize;
  const quietZoneModules = hasQuietZone ? (size - originalSize) / 2 : 4;
  const totalModules = originalSize + quietZoneModules * 2;
  const modulePixelSize = Math.floor(QR_MAX_DISPLAY_SIZE_PX / totalModules);
  const canvasSize = totalModules * modulePixelSize;

  context.canvas.width = canvasSize;
  context.canvas.height = canvasSize;
  context.canvas.style.width = `${canvasSize}px`;
  context.canvas.style.height = `${canvasSize}px`;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, canvasSize, canvasSize);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const margin = quietZoneModules * modulePixelSize;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dataIndex = y * size + x;
      if (!(pixelData[dataIndex] & 0x1)) continue;

      const originalX = hasQuietZone ? x - quietZoneModules : x;
      const originalY = hasQuietZone ? y - quietZoneModules : y;
      if (originalX < 0 || originalY < 0 || originalX >= originalSize || originalY >= originalSize)
        continue;
      if (isLocatorModule(originalX, originalY, originalSize)) continue;

      const centerX = margin + (originalX + 0.5) * modulePixelSize;
      const centerY = margin + (originalY + 0.5) * modulePixelSize;
      const radius = modulePixelSize / 2 - 1;

      context.fillStyle = MODULE_COLOR;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      context.fill();
    }
  }

  drawLocators(context, originalSize, margin, modulePixelSize);
  drawCenterImage(context, canvasSize, modulePixelSize);
}

export function QRCodeImg({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [moduleStatus, setModuleStatus] = useState<"loading" | "ready" | "error">("loading");
  const [renderStatus, setRenderStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let isMounted = true;
    initialize()
      .then(() => {
        if (isMounted) setModuleStatus("ready");
      })
      .catch(() => {
        if (isMounted) setModuleStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (moduleStatus === "loading") {
      setRenderStatus("loading");
      return;
    }

    if (moduleStatus === "error") {
      setRenderStatus("error");
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) {
      setRenderStatus("error");
      return;
    }

    setRenderStatus("loading");

    try {
      const result = generateQRCode(value, {
        moduleStyle: ModuleStyle.Circles,
        locatorStyle: LocatorStyle.Rounded,
        centerImage: CenterImage.Dino,
        quietZone: QuietZone.WillBeAddedByClient,
      });
      try {
        renderQRCodeChromiumStyle(context, result.data, result.size, result.original_size);
        setRenderStatus("ready");
      } finally {
        result.free();
      }
    } catch {
      setRenderStatus("error");
    }
  }, [moduleStatus, value]);

  return (
    <div className="text-share-qr-card">
      <div className="text-share-qr-paper">
        {renderStatus === "error" ? (
          <div className="text-share-qr-error">生成失败</div>
        ) : (
          <canvas ref={canvasRef} aria-label="分享二维码" className="text-share-qrcode" />
        )}
      </div>
      {renderStatus === "loading" ? (
        <p className="text-share-hint">生成中...</p>
      ) : renderStatus === "ready" ? (
        <p className="text-share-hint">手机扫码查看</p>
      ) : null}
    </div>
  );
}
