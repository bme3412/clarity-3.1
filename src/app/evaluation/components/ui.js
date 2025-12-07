export function ScoreCard({ label, value, colorClass }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center justify-center">
      <div className={`text-3xl font-bold mb-1 ${colorClass}`}>
        {(value * 100).toFixed(1)}%
      </div>
      <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </div>
    </div>
  );
}

export function StatusBadge({ score }) {
  let color = 'bg-red-500/10 text-red-500 border-red-500/20';
  if (score >= 0.8) color = 'bg-green-500/10 text-green-500 border-green-500/20';
  else if (score >= 0.5) color = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${color}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}


