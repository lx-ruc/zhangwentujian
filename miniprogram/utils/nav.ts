/**
 * 顶部安全区对齐（像素级）
 * 全站 custom 导航：内容顶边需与右上角胶囊对齐或避开。
 * CSS env(safe-area-inset-top) 在部分 Android 机型≠状态栏高度（可取 0），
 * 故统一用 wx.getMenuButtonBoundingClientRect() 的真实胶囊坐标。
 * 同步调用，可直接用于 Page data 初始化（无 setData 闪烁）。
 */

/** 内容顶边 = 胶囊顶边（平行胶囊：index/capture/analyzing/about） */
export function getNavTopPx(): number {
  try {
    const menu = wx.getMenuButtonBoundingClientRect();
    if (menu && menu.top > 0) return menu.top;
  } catch { /* 落到兜底 */ }
  return statusBarPlus(6);
}

/** 内容顶边 = 胶囊底部 + 10px（避开胶囊：report/collection/history，顶右有元素） */
export function getNavBelowPx(): number {
  try {
    const menu = wx.getMenuButtonBoundingClientRect();
    if (menu && menu.bottom > 0) return menu.bottom + 10;
  } catch { /* 落到兜底 */ }
  return statusBarPlus(48);
}

function statusBarPlus(extraPx: number): number {
  try {
    const win = wx.getWindowInfo();
    return (win.statusBarHeight || 0) + extraPx;
  } catch {
    return 44 + extraPx; // 主流刘海屏 statusBar 高度的保守值
  }
}
