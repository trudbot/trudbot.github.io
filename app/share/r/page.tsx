import "@fontsource/caveat/latin-600.css";
import "@fontsource/caveat/latin-700.css";
import "../styles.css";
import { Suspense } from "react";
import ReceiveClient from "./receive-client";
import { ReceiveShell } from "./receive-shell";

export default function ReceivePage() {
  return (
    <Suspense fallback={<ReceiveShell content="" />}>
      <ReceiveClient />
    </Suspense>
  );
}
