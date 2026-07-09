export default function InstallPwaHint({ open, onDismiss }) {
  if (!open) return null;

  return (
    <div className="install-pwa-backdrop" role="presentation">
      <section className="install-pwa-hint" role="dialog" aria-modal="true" aria-label="添加到桌面提示">
        <button type="button" className="install-pwa-close" onClick={onDismiss} aria-label="关闭安装提示">
          ×
        </button>
        <div>
          <span>像 App 一样使用锋辩</span>
          <p>你可以将锋辩添加到手机桌面，下次直接点击图标进入训练。</p>
          <ul>
            <li>安卓浏览器：点击浏览器菜单，选择“添加到主屏幕”或“安装应用”。</li>
            <li>iPhone Safari：点击分享按钮，选择“添加到主屏幕”。</li>
            <li>微信内打开：请先点击右上角，在浏览器中打开后再添加到桌面。</li>
          </ul>
        </div>
        <button type="button" className="install-pwa-primary" onClick={onDismiss}>
          知道了
        </button>
      </section>
    </div>
  );
}
