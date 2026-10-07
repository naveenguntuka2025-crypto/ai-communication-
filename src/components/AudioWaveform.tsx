import React, { useEffect, useState } from "react";

interface AudioWaveformProps {
  isActive: boolean;
  audioLevel?: number; // 0 to 1
  isWarning?: boolean; // filler word or pacing alert
  barCount?: number;
  height?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isActive,
  audioLevel = 0,
  isWarning = false,
  barCount = 36,
  height = 48,
}) => {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0.15)
  );

  useEffect(() => {
    if (!isActive) {
      // Subtle resting wave
      const interval = setInterval(() => {
        setBars((prev) =>
          prev.map((_, i) => 0.12 + Math.sin(Date.now() / 600 + i * 0.4) * 0.06)
        );
      }, 100);
      return () => clearInterval(interval);
    }

    // Active wave reacting to audioLevel
    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map((_, i) => {
          const noise = Math.random() * 0.3;
          const centerBias = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
          const val = Math.min(
            1,
            Math.max(0.12, (audioLevel * 1.5 + noise) * (0.4 + centerBias * 0.6))
          );
          return val;
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, [isActive, audioLevel, barCount]);

  const activeColor = isWarning ? "bg-amber-500" : "bg-[#4f46e5]";
  const restingColor = "bg-slate-200";

  return (
    <div
      className="flex items-center justify-center gap-[2px] w-full select-none"
      style={{ height: `${height}px` }}
    >
      {bars.map((bar, i) => {
        const barHeight = Math.max(4, Math.round(bar * height));
        return (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all duration-75 ${
              isActive ? activeColor : restingColor
            }`}
            style={{
              height: `${barHeight}px`,
              opacity: isActive ? 0.9 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
};
