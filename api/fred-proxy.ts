import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "https://reecebernard.dev");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { series } = req.query;

    if (!series || typeof series !== "string") {
      return res.status(400).json({ error: "Missing series parameter" });
    }

    const allowedSeries = ["MORTGAGE15US", "MORTGAGE30US"];
    if (!allowedSeries.includes(series)) {
      return res.status(400).json({ error: "Unauthorized series" });
    }

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${process.env.FRED_API_KEY}&file_type=json&start_date=${startDate}&end_date=${endDate}&sort_order=desc&limit=1`;

    const fredResponse = await fetch(fredUrl);

    if (!fredResponse.ok) {
      throw new Error(`FRED API error: ${fredResponse.status}`);
    }

    const fredData = await fredResponse.json();

    if (!fredData.observations || fredData.observations.length === 0) {
      throw new Error("No data available");
    }

    const latestObservation = fredData.observations[0];
    const rate = parseFloat(latestObservation.value);

    if (isNaN(rate)) {
      throw new Error("Invalid rate data");
    }

    return res.status(200).json({
      series,
      rate,
      date: latestObservation.date,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("FRED Proxy Error:", error);

    const fallbackRates: Record<string, number> = {
      MORTGAGE15US: 6.81,
      MORTGAGE30US: 7.22,
    };

    const series = req.query.series as string;
    const fallbackRate = fallbackRates[series] || 7.0;

    return res.status(200).json({
      series,
      rate: fallbackRate,
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      fallback: true,
    });
  }
}
