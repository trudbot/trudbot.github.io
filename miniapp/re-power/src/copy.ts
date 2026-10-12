import type { LevelRecord } from "./save";
import type { SyncState } from "./ranking";

/** One line explaining where a first clear stands on the ranked boards. */
export function submitNote(rec: LevelRecord | undefined, sync: SyncState): string {
  if (!rec) return "首次通关的用时与步数计入排行";
  if (rec.submit === "done") return "首次通关成绩已计入排行";
  if (rec.submit === "exists") return "该账号已有排行记录，以最早的首通为准";
  switch (sync.status) {
    case "syncing":
      return "正在提交首通成绩…";
    case "unauthorized":
      return "未登录小黑盒：首通成绩已存本机，登录后自动提交";
    case "offline":
      return "不在小黑盒内运行：首通成绩仅保存在本机";
    case "rate_limited":
      return "提交过于频繁，稍后自动重试";
    case "error":
      return `提交失败${sync.code ? `（${sync.code}）` : ""}，稍后重试`;
    default:
      return "首通成绩等待提交";
  }
}
