export interface Game {
  id: string;
  name: string;
  coverUrl: string;
  review: string;
}

export const favoriteGames: Game[] = [
  {
    id: "1",
    name: "生化危机4",
    coverUrl: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2026/03/08/1772909448682_093847a6f63eabca9b12d33661376d90.png",
    review: "找不到瑕疵的完美游戏",
  },
  {
    id: "2",
    name: "怪物猎人崛起",
    coverUrl: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2026/03/08/1772909448683_e9c25c09fd727e3ac3a773c75a59bc71.png",
    review: "极具深度的动作系统",
  },
  {
    id: "3",
    name: "赛博朋克2077",
    coverUrl: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2026/03/08/1772909448683_561adbb4e6094bef3c29e38ceb6bd929.png",
    review: "引人入胜的剧情",
  },
  {
    id: "4",
    name: "只狼",
    coverUrl: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2026/03/08/1772909449093_324fd03958724e32847aa8b8e35b511f.png",
    review: "无与伦比的战斗反馈",
  },
];
