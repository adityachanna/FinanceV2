// Original vector artwork: research, market structure and scenarios share one landscape.
// The travelling dots illustrate a data connection; they are not simulated quotes.
function Tower({ x, y, height, fill, width = 65 }) {
  const depth = width * .52;
  return <g transform={`translate(${x} ${y})`} stroke="#a9bbc1" strokeWidth="1.1" strokeLinejoin="round">
    <path d={`M0 0 ${width} ${-depth} ${width * 2} 0 ${width} ${depth}Z`} fill="#edf3f5" />
    <path d={`M0 0V${-height}L${width} ${-height - depth}V${-depth}Z`} fill={fill} />
    <path d={`M${width} ${-depth}V${-height - depth}L${width * 2} ${-height}V0Z`} fill="#f5f8fa" />
    <path d={`M0 ${-height} ${width} ${-height - depth} ${width * 2} ${-height} ${width} ${-height + depth}Z`} fill="#fcfefe" />
    {Array.from({ length: Math.floor(height / 30) }, (_, i) => <path key={i} d={`M0 ${-i * 30} ${width} ${depth - i * 30} ${width * 2} ${-i * 30}`} fill="none" opacity=".65" />)}
    <path d={`M${width} ${-height + depth}V${depth}`} fill="none" />
  </g>;
}

function Tree({ x, y, size = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} stroke="#acbfc0" strokeWidth="1.2">
    <path d="m-11 6 11-6 11 6-11 6Z" fill="#f0f5f3" /><path d="M0 6v-34" />
    <path d="M-13-30C-13-55 13-55 13-30c0 20-26 20-26 0Z" fill="#b8ded0" /><path d="m0-36 6-5m-6 15-6-5" fill="none" />
  </g>;
}

export default function MarketLandscape() {
  return <div className="market-landscape">
    <svg viewBox="0 0 1200 460" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="landscape-fade" x1="600" x2="600" y1="270" y2="455" gradientUnits="userSpaceOnUse"><stop stopColor="#f3f8f7" /><stop offset="1" stopColor="white" /></linearGradient>
        <pattern id="landscape-dots" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d9e5e1" /></pattern>
      </defs>
      <ellipse cx="600" cy="335" rx="535" ry="115" fill="url(#landscape-fade)" />
      <path d="M18 315 382 110Q407 95 431 108l675 324M92 433 708 106q24-13 49 0l390 207" stroke="#e3eceb" strokeWidth="29" strokeLinejoin="round" />
      <path d="M18 315 382 110Q407 95 431 108l675 324M92 433 708 106q24-13 49 0l390 207" stroke="white" strokeWidth="23" strokeLinejoin="round" />
      <path d="m72 358 132-75m694-49 234 112" stroke="#bed7ce" strokeWidth="2" strokeDasharray="5 8" className="landscape-connection" />
      <path d="m130 336 132-75m671-7 148 72" stroke="#63b6a0" strokeWidth="5" strokeDasharray="1 140" strokeLinecap="round" className="landscape-packets" />
      <path d="m405 300 240-130 321 164-243 133Z" fill="url(#landscape-dots)" />
      <path d="m393 296 253-136 324 166-252 139Z" fill="#f3f8f7" stroke="#b9cccb" />
      <path d="m393 296 325 169v13L393 310Z" fill="#d4e5e0" stroke="#b9cccb" /><path d="m718 465 252-139v13L718 478Z" fill="#ecf4f1" stroke="#b9cccb" />
      <g transform="matrix(1 .51 -1 .54 647 186)">
        <path d="M0 0H281V208H0Z" fill="#fff" stroke="#c5d7d2" />
        {[52, 104, 156].map(y => <path key={y} d={`M0 ${y}H281`} stroke="#e2eeea" />)}
        {[56, 112, 168, 224].map(x => <path key={x} d={`M${x} 0V208`} stroke="#e2eeea" />)}
        <path d="M0 165 17 160 27 171 42 142 54 154 70 125 80 135 94 120 110 143 122 98 133 112 148 83 163 103 174 70 185 79 203 47 214 62 228 40 239 50 255 18 268 30 281 12V208H0Z" fill="#d2ece2" fillOpacity=".65" />
        <path d="M0 165 17 160 27 171 42 142 54 154 70 125 80 135 94 120 110 143 122 98 133 112 148 83 163 103 174 70 185 79 203 47 214 62 228 40 239 50 255 18 268 30 281 12" stroke="#4f9e89" strokeWidth="3" strokeLinejoin="round" className="landscape-price-path" pathLength="1" />
        <circle cx="281" cy="12" r="5" fill="#087f83" />
      </g>
      <g stroke="#a9bbc1" strokeWidth="1.1" strokeLinejoin="round">
        <path d="m138 261 145-78 170 88-144 79Z" fill="#f0f6f4" /><path d="m138 261 171 89v26l-171-88Z" fill="#c7e2d8" /><path d="m309 350 144-79v27l-144 78Z" fill="#e5efec" />
        <path d="M173 245V147l112-61 132 69v100l-112 61Z" fill="#f0f5f7" /><path d="m173 147 132 69v100l-132-71Z" fill="#b7ddcf" />
        <path d="m173 147 112-61 132 69-112 61Z" fill="#fbfdfd" />
        <path d="m187 138 98-53 115 60-97 53Z" fill="#e2eeeb" />
        {[0, 1, 2, 3].map(i => <path key={i} d={`m${191 + i * 27} ${172 + i * 14}v53l17 9v-53Z`} fill="#e8f6f0" />)}
        <path d="m306 235 111-60v36l-111 61Z" fill="#284650" />
        <path d="m317 242 10-12 9 4 8-14 10 4 9-13 9 5 11-18 11 4 13-17" stroke="#a3daca" strokeWidth="2.5" />
        <path d="m285 86 0-57m-8 17 31-17v21l-31 17Z" fill="#b6d9d0" />
      </g>
      <g transform="translate(222 139) matrix(1 .52 0 1 0 0)"><image href="/alphasharp-mark.svg" width="28" height="28" /><text x="35" y="19" fill="#285048" fontFamily="Manrope, sans-serif" fontSize="11" fontWeight="700">AlphaSharp</text></g>
      <Tower x={785} y={210} height={155} fill="#bbdfd2" width={42} />
      <Tower x={870} y={253} height={118} fill="#d1d8f3" width={42} />
      <Tower x={955} y={298} height={80} fill="#e4d8c4" width={42} />
      <g stroke="#acbdc4" strokeWidth="1.1"><path d="m78 367 61-33 47 24v-91l-47-24-61 33Z" fill="#f8fbfc" /><path d="m78 276 47 25v91l-47-25Z" fill="#c6e5d9" /><path d="m125 301 61-34v91l-61 34Z" fill="#f4f8fa" /><path d="m137 333 10-11 9 5 18-24" stroke="#6eafa0" strokeWidth="3" /></g>
      <Tree x={465} y={155} size={.8} /><Tree x={1048} y={388} /><Tree x={1110} y={267} size={.8} /><Tree x={340} y={405} /><Tree x={524} y={418} size={.7} /><Tree x={698} y={129} size={.65} /><Tree x={96} y={195} size={.6} />
      <g transform="translate(1074 137)" stroke="#acbdc4"><path d="M0 66V0l-29 15v50" /><path d="m-45 7 78-42v43l-78 42Z" fill="#e7e3fa" /><path d="m-31 17 12-6 8-16 12 5 17-22" stroke="#8d84c5" strokeWidth="2" /></g>
      <circle cx="1030" cy="100" r="3" fill="#b7d6cc" /><circle cx="452" cy="80" r="2" fill="#bbc6dc" /><circle cx="68" cy="247" r="2" fill="#d7d1ed" />
    </svg>
    <a className="landscape-label landscape-stocks" href="#research"><span className="landscape-label-dot" /> Company research</a>
    <a className="landscape-label landscape-regimes" href="#market"><span className="landscape-label-dot" /> Market regimes</a>
    <a className="landscape-label landscape-risk" href="#risk"><span className="landscape-label-dot" /> Risk scenarios</a>
    <span className="landscape-caption">Your research, connected.</span>
  </div>;
}
