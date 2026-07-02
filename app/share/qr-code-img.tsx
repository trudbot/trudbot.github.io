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
const LOCATOR_SIZE_MODULES = 7;
const CENTER_LOGO_SRC = "/share-center-logo.png";
const CENTER_LOGO_MODULES = 9;

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

function drawCenterImage(
  context: CanvasRenderingContext2D,
  totalModules: number,
  modulePixelSize: number,
  centerLogo: CanvasImageSource,
) {
  const logoModules = Math.min(CENTER_LOGO_MODULES, totalModules - 8);
  const logoSize = logoModules * modulePixelSize;
  const logoStartModule = Math.floor((totalModules - logoModules) / 2);
  const logoX = logoStartModule * modulePixelSize;
  const logoY = logoStartModule * modulePixelSize;

  context.drawImage(centerLogo, logoX, logoY, logoSize, logoSize);
}

function renderQRCodeChromiumStyle(
  context: CanvasRenderingContext2D,
  pixelData: Uint8Array,
  size: number,
  originalSize: number,
  centerLogo: CanvasImageSource,
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
  drawCenterImage(context, totalModules, modulePixelSize, centerLogo);
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
    let isMounted = true;

    async function renderQRCode() {
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
        const centerLogo = new Image();
        centerLogo.decoding = "async";
        centerLogo.src = CENTER_LOGO_SRC;
        await centerLogo.decode();
        if (!isMounted) return;

        const result = generateQRCode(value, {
          moduleStyle: ModuleStyle.Circles,
          locatorStyle: LocatorStyle.Rounded,
          centerImage: CenterImage.Dino,
          quietZone: QuietZone.WillBeAddedByClient,
        });
        try {
          renderQRCodeChromiumStyle(
            context,
            result.data,
            result.size,
            result.original_size,
            centerLogo,
          );
          setRenderStatus("ready");
        } finally {
          result.free();
        }
      } catch {
        if (isMounted) setRenderStatus("error");
      }
    }

    renderQRCode();

    return () => {
      isMounted = false;
    };
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
    </div>
  );
}
