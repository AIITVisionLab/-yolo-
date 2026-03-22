export function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark${compact ? " brand-mark--compact" : ""}`}>
      <span className="brand-mark__glyph" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 38V25" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M24 25C17 25 12 19.6 12 12.4C18.7 12.4 24 17.7 24 25Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M24 25C31 25 36 19.6 36 12.4C29.3 12.4 24 17.7 24 25Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M16 34.5C18.2 31.8 20.8 30.4 24 30.4C27.2 30.4 29.8 31.8 32 34.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      </span>
      <div className="brand-mark__copy">
        <strong>PlantOps</strong>
        <span>植物病害识别平台</span>
      </div>
    </div>
  );
}
