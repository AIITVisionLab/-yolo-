export function HeroVisual({
  workspaceLabel,
  healthLabel,
  modelLabel,
  sessionLabel,
  datasetCount,
  locked = false,
}) {
  return (
    <div className={`hero-visual${locked ? " is-locked" : ""}`}>
      <div className="hero-visual__grid" aria-hidden="true" />
      <div className="hero-visual__glow hero-visual__glow--primary" aria-hidden="true" />
      <div className="hero-visual__glow hero-visual__glow--secondary" aria-hidden="true" />
      <svg className="hero-visual__art" viewBox="0 0 720 560" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="heroWave" x1="52" y1="92" x2="622" y2="496" gradientUnits="userSpaceOnUse">
            <stop stopColor="#DCEFD5" />
            <stop offset="1" stopColor="#79AF87" />
          </linearGradient>
          <linearGradient id="heroArc" x1="188" y1="118" x2="566" y2="422" gradientUnits="userSpaceOnUse">
            <stop stopColor="#255E43" />
            <stop offset="1" stopColor="#163627" />
          </linearGradient>
          <linearGradient id="heroLeaf" x1="176" y1="154" x2="440" y2="426" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F0F8EA" />
            <stop offset="1" stopColor="#8AC197" />
          </linearGradient>
        </defs>
        <path d="M62 425C164 316 247 274 310 299C372 324 434 317 495 277C560 233 613 228 654 261V534H62V425Z" fill="url(#heroWave)" fillOpacity="0.78" />
        <path d="M182 166C241 118 315 109 402 140C471 164 528 228 572 331C482 314 411 334 360 393C304 354 249 310 196 262C174 236 169 204 182 166Z" fill="url(#heroArc)" />
        <path d="M196 214C258 170 326 168 401 209C367 265 359 322 376 380C294 386 225 367 170 324C168 281 177 244 196 214Z" fill="url(#heroLeaf)" />
        <path d="M261 441C308 374 364 342 430 347C477 350 525 375 575 422" stroke="#F6FCF3" strokeWidth="14" strokeLinecap="round" />
        <path d="M293 399C328 365 369 348 414 348C453 348 493 364 531 396" stroke="#194936" strokeWidth="7" strokeLinecap="round" />
        <circle cx="584" cy="146" r="18" fill="#E8F7DF" fillOpacity="0.9" />
        <circle cx="144" cy="182" r="11" fill="#113120" />
      </svg>

      <div className="hero-visual__meta">
        <div className="hero-visual__meta-copy">
          <span className="hero-visual__label">Active Surface</span>
          <strong>{workspaceLabel}</strong>
          <p>{locked ? "登录后即可解锁写入与训练能力。" : "当前模块已经接入原生 React 工作区。"}</p>
        </div>
        <div className="hero-visual__signals">
          <article className="hero-visual__signal">
            <span>服务</span>
            <strong>{healthLabel}</strong>
          </article>
          <article className="hero-visual__signal">
            <span>模型</span>
            <strong>{modelLabel}</strong>
          </article>
          <article className="hero-visual__signal">
            <span>会话</span>
            <strong>{sessionLabel}</strong>
          </article>
          <article className="hero-visual__signal">
            <span>数据集</span>
            <strong>{datasetCount}</strong>
          </article>
        </div>
      </div>
    </div>
  );
}
