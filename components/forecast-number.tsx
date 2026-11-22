/** EasyUI Animated Number's rolling digit columns; CSS replaces its spring dependency. */
export function ForecastNumber({ value }: { value: number }) {
  const text = String(Number(value.toFixed(1)));
  return <span className="forecast-number" aria-live="polite" aria-atomic="true">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true" className="forecast-digits" dir="ltr">
      {[...text].map((digit, i) => /\d/.test(digit)
        ? <span key={text.length - i} className="forecast-digit"><span style={{ transform: `translateY(-${Number(digit) * 10}%)` }}>{Array.from({ length: 10 }, (_, n) => <span key={n}>{n}</span>)}</span></span>
        : <span key={text.length - i}>{digit}</span>)}
    </span>
  </span>;
}
