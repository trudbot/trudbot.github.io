"use client";
import { useEffect, useState } from "react";
import { decodeShareContent, getOpenableUrl } from "../receive-params";
import { ReceiveShell } from "./receive-shell";

function useClipboard() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const copy = async (text: string) => {
    const copyWithTextarea = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    };

    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } else {
        copyWithTextarea();
      }
    } catch (e) {
      try {
        copyWithTextarea();
      } catch {
        console.error("Failed to copy", e);
      }
    }
  };

  return { copy, copied };
}

export default function ReceiveClient() {
  const initialContent =
    typeof window === "undefined" ? "" : decodeShareContent(window.location.search);
  const [receivedContent] = useState(initialContent);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const { copy, copied } = useClipboard();

  useEffect(() => {
    setCurrentOrigin(window.location.origin + window.location.pathname.replace("/r", ""));
  }, []);

  const openInNewTab = () => {
    const openableUrl = getOpenableUrl(receivedContent);
    if (openableUrl) {
      const openedWindow = window.open(openableUrl, "_blank", "noopener,noreferrer");
      if (openedWindow) openedWindow.opener = null;
    }
  };

  const goToShare = () => {
    window.location.href = currentOrigin || "/share";
  };

  return (
    <ReceiveShell
      content={receivedContent}
      copied={copied}
      interactive={Boolean(receivedContent)}
      onCopy={() => copy(receivedContent)}
      onOpen={openInNewTab}
      onGoToShare={goToShare}
    />
  );
}
