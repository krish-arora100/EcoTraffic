import { Suspense } from "react";
import ChartView from "./ChartView";

export default function GraphsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#181f1a', padding: '48px 0', fontFamily: 'inherit' }}>
      <Suspense fallback={<div>Loading chart...</div>}>
        <ChartView />
      </Suspense>
    </main>
  );
}
