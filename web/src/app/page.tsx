"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
  status: string;
  database: boolean;
  redis: boolean;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/health`)
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Easy Convert AI</h1>
      <p className="text-lg text-gray-600 mb-8">
        AI 驱动的文档转换平台
      </p>

      <div className="border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">系统状态</h2>
        {error && (
          <p className="text-red-500">连接失败: {error}</p>
        )}
        {health && (
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>API</span>
              <span className={health.status === "healthy" ? "text-green-500" : "text-yellow-500"}>
                {health.status}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Database</span>
              <span className={health.database ? "text-green-500" : "text-red-500"}>
                {health.database ? "connected" : "disconnected"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Redis</span>
              <span className={health.redis ? "text-green-500" : "text-red-500"}>
                {health.redis ? "connected" : "disconnected"}
              </span>
            </li>
          </ul>
        )}
        {!health && !error && (
          <p className="text-gray-400">正在检查...</p>
        )}
      </div>
    </main>
  );
}
