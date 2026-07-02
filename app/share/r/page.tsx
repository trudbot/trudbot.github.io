import "@fontsource/caveat/latin-400.css";
import "@fontsource/caveat/latin-500.css";
import "@fontsource/caveat/latin-600.css";
import "@fontsource/caveat/latin-700.css";
import "../styles.css";
import { Suspense } from "react";
import ReceiveClient from "./receive-client";

// Static export compatible - client-side params parsing
export default function ReceivePage() {
  return (
    <Suspense
      fallback={
        <div className="text-share-page">
          <main className="text-share-main">
            <div className="text-share-empty">加载中...</div>
          </main>
        </div>
      }
    >
      <ReceiveClient />
    </Suspense>
  );
}
