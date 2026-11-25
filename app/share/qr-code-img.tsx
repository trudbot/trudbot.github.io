import { useEffect, useRef, useState } from "react";

type QRGenerator = typeof import("@chromium-style-qrcode/generator");

// 生成器内联了 base64 的 wasm，体积比页面其余代码加起来还大，而二维码要等用户
// 输入后才出现，因此不进首屏，按需加载并初始化。
let generatorPromise: Promise<QRGenerator> | undefined;
export function loadQRGenerator() {
  generatorPromise ??= import("@chromium-style-qrcode/generator")
    .then(async (generator) => {
      await generator.initialize();
      return generator;
    })
    .catch((error: unknown) => {
      // 失败后允许下次调用重试，而不是永远拿到同一个 rejected promise。
      generatorPromise = undefined;
      throw error;
    });
  return generatorPromise;
}

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
  const [generator, setGenerator] = useState<QRGenerator | "loading" | "error">("loading");
  const [renderStatus, setRenderStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let isMounted = true;
    loadQRGenerator()
      .then((loaded) => {
        if (isMounted) setGenerator(loaded);
      })
      .catch(() => {
        if (isMounted) setGenerator("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function renderQRCode() {
      if (generator === "loading") {
        setRenderStatus("loading");
        return;
      }

      if (generator === "error") {
        setRenderStatus("error");
        return;
      }
      const { generateQRCode, ModuleStyle, LocatorStyle, CenterImage, QuietZone } = generator;

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
  }, [generator, value]);

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
