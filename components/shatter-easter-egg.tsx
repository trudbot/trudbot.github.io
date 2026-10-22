"use client";

import { useEffect } from "react";
import { installShatterTrigger } from "@/lib/glass-shatter/trigger";

/* 首页隐藏彩蛋：在页面上连续快速点击会让页面像玻璃一样碎裂，规则见 lib/glass-shatter/trigger.ts。 */
export function ShatterEasterEgg() {
  useEffect(() => installShatterTrigger(), []);
  return null;
}
