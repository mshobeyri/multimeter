import React, { useMemo, useState } from 'react';

interface LoadSeriesPoint {
  timestamp: string;
  active_threads?: number;
  requests?: number;
  errors?: number;
  error_delta?: number;
  throughput?: number;
  response_time?: number;
  error_rate?: number;
}

interface LoadTestReportData {
  config?: {
    threads?: number;
    repeat?: string | number;
    rampup?: string;
  };
  summary?: {
    iterations?: number;
    requests?: number;
    successes?: number;
    failures?: number;
    success_rate?: number;
    failed_rate?: number;
    error_rate?: number;
    throughput?: number;
  };
  http?: {
    status_codes?: Record<string, number>;
    failed_requests?: number;
  };
  series?: LoadSeriesPoint[];
}

interface LoadTestReportProps {
  load: LoadTestReportData | null;
  config?: LoadTestReportData['config'] | null;
}

const cardStyle: React.CSSProperties = {
  borderRadius: 10,
  background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
  border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
  padding: 12,
  minWidth: 0,
};

function formatNumber(value: number | undefined, fractionDigits = 0): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(fractionDigits) : '-';
}

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
}

interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  axis?: 'left' | 'right';
}

const LoadLineChart: React.FC<{
  title: string;
  points: LoadSeriesPoint[];
  series: ChartSeries[];
}> = ({ title, points, series }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 760;
  const height = 220;
  const left = 46;
  const right = rightSeriesSafeMargin(series);
  const top = 22;
  const bottom = 34;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const leftSeries = series.filter(s => s.axis !== 'right');
  const rightSeries = series.filter(s => s.axis === 'right');
  const maxLeftY = Math.max(1, ...leftSeries.flatMap(s => s.values).filter(v => Number.isFinite(v)));
  const maxRightY = Math.max(1, ...rightSeries.flatMap(s => s.values).filter(v => Number.isFinite(v)));
  const count = Math.max(1, points.length - 1);
  const xFor = (index: number) => left + (count === 0 ? 0 : (index / count) * innerWidth);
  const yFor = (value: number, axis: 'left' | 'right' = 'left') => {
    const maxY = axis === 'right' ? maxRightY : maxLeftY;
    return top + innerHeight - (Math.max(0, value) / maxY) * innerHeight;
  };
  const grid = [0, 0.25, 0.5, 0.75, 1];
  const hoverPoint = hoverIndex != null ? points[hoverIndex] : undefined;
  const tooltipLeft = hoverIndex != null ? `${(xFor(hoverIndex) / width) * 100}%` : '0%';

  return (
    <div style={{ ...cardStyle, marginBottom: 12, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div className="label" style={{ marginBottom: 2 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {series.map(item => (
            <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {points.length === 0 ? (
        <div style={{ opacity: 0.75, padding: '26px 0' }}>Run the load test to collect chart data.</div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <rect x={left} y={top} width={innerWidth} height={innerHeight} fill="transparent" stroke="var(--vscode-widget-border, rgba(255,255,255,0.12))" />
          {grid.map(ratio => {
            const y = top + innerHeight - ratio * innerHeight;
            const leftLabel = Math.round(maxLeftY * ratio);
            const rightLabel = Math.round(maxRightY * ratio);
            return (
              <g key={ratio}>
                <line x1={left} x2={left + innerWidth} y1={y} y2={y} stroke="var(--vscode-widget-border, rgba(255,255,255,0.12))" strokeDasharray="3 4" />
                <text x={left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--vscode-descriptionForeground, #8b949e)">{leftLabel}</text>
                {rightSeries.length > 0 && <text x={left + innerWidth + 8} y={y + 4} textAnchor="start" fontSize="10" fill="var(--vscode-descriptionForeground, #8b949e)">{rightLabel}</text>}
              </g>
            );
          })}
          {series.map(item => {
            const axis = item.axis || 'left';
            const path = item.values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value, axis)}`).join(' ');
            return <path key={item.key} d={path} fill="none" stroke={item.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />;
          })}
          {series.map(item => item.values.map((value, index) => {
            const axis = item.axis || 'left';
            return <circle key={`${item.key}-${index}`} cx={xFor(index)} cy={yFor(value, axis)} r="2.5" fill={item.color} />
          }))}
          {points.map((_, index) => {
            const bandWidth = points.length <= 1 ? innerWidth : innerWidth / Math.max(1, points.length - 1);
            const x = Math.max(left, xFor(index) - bandWidth / 2);
            const maxWidth = left + innerWidth - x;
            return (
              <rect
                key={`hover-${index}`}
                x={x}
                y={top}
                width={Math.max(6, Math.min(bandWidth, maxWidth))}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseMove={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
          {points.length > 1 && (
            <>
              <text x={left} y={height - 10} fontSize="10" fill="var(--vscode-descriptionForeground, #8b949e)">{timeLabel(points[0].timestamp)}</text>
              <text x={left + innerWidth} y={height - 10} textAnchor="end" fontSize="10" fill="var(--vscode-descriptionForeground, #8b949e)">{timeLabel(points[points.length - 1].timestamp)}</text>
            </>
          )}
        </svg>
      )}
      {hoverPoint && (
        <div style={{
          position: 'absolute',
          left: tooltipLeft,
          top: 44,
          transform: 'translateX(-50%)',
          zIndex: 5,
          pointerEvents: 'none',
          minWidth: 170,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'var(--vscode-editorWidget-background, #252526)',
          border: '1px solid var(--vscode-editorWidget-border, #454545)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          fontSize: 11,
          lineHeight: 1.45,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{timeLabel(hoverPoint.timestamp || '')}</div>
          <div>Threads: {formatNumber(hoverPoint.active_threads)}</div>
          <div>Failures: {formatNumber(hoverPoint.errors)}</div>
          <div>Requests/sec: {formatNumber(hoverPoint.throughput, 2)}</div>
          <div>Response time: {formatNumber(hoverPoint.response_time, 2)} ms</div>
        </div>
      )}
    </div>
  );
};

function rightSeriesSafeMargin(series: ChartSeries[]): number {
  return series.some(item => item.axis === 'right') ? 58 : 28;
}

const LoadTestReport: React.FC<LoadTestReportProps> = ({ load }) => {
  const points = useMemo(() => load?.series || [], [load]);

  const activeThreadValues = points.map(p => Number(p.active_threads || 0));
  const errorValues = points.map(p => Number(p.errors || 0));
  const requestRateValues = points.map(p => Number(p.throughput || 0));
  const responseTimeValues = points.map(p => Number(p.response_time || 0));

  return (
    <div style={{ marginTop: 4 }}>
      <div className="label" style={{ marginBottom: 8 }}>Load Report</div>
      <LoadLineChart
        title="Requests per second and Response time over time"
        points={points}
        series={[
          { key: 'rps', label: 'Requests/sec', color: 'var(--vscode-textLink-foreground, #58a6ff)', values: requestRateValues },
          { key: 'response_time', label: 'Response time (ms)', color: 'var(--vscode-descriptionForeground, #8b949e)', values: responseTimeValues, axis: 'right' },
        ]}
      />

      <LoadLineChart
        title="Threads and Failures over time"
        points={points}
        series={[
          { key: 'errors', label: 'Failures', color: 'var(--vscode-testing-iconFailed, #f85149)', values: errorValues },
          { key: 'threads', label: 'Threads', color: 'var(--vscode-charts-yellow, #d29922)', values: activeThreadValues, axis: 'right' },
        ]}
      />
    </div>
  );
};

export default LoadTestReport;