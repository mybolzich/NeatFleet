import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", geminiEnabled: !!geminiApiKey });
});

// Route analyzer / AI Dispatch Copilot API
app.post("/api/ai-analyze", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Secrets panel."
      });
    }

    const { stops, vehicles, config, customPrompt } = req.body;

    const fleetSummary = vehicles.map((v: any) => ({
      name: v.name,
      capacity: v.capacity,
      loadUsed: v.metrics.loadUsed,
      utilization: `${Math.round((v.metrics.loadUsed / v.capacity) * 100)}%`,
      distance: `${v.metrics.totalDistance} units`,
      duration: `${v.metrics.totalTime} mins`,
      delays: v.metrics.delayCount,
      cost: `$${v.metrics.totalCost}`
    }));

    const delayedStops = stops
      .filter((s: any) => s.assignedVehicleId && s.arrivalTime > s.timeWindowEnd)
      .map((s: any) => ({
        name: s.name,
        customer: s.customer,
        address: s.address,
        volume: s.volume,
        timeWindow: `${s.timeWindowStart}-${s.timeWindowEnd} (min from 8AM)`,
        arrivalTime: `${s.arrivalTime} (min from 8AM)`,
        assignedVehicle: vehicles.find((v: any) => v.id === s.assignedVehicleId)?.name || 'Unknown'
      }));

    const unassignedCount = stops.filter((s: any) => !s.assignedVehicleId).length;

    const systemInstruction = `You are the Workwave RouteManager AI Dispatch Copilot. You analyze vehicle routing profiles, identify bottleneck trends, and offer tactical logistics suggestions.
Keep your analysis highly actionable, professional, and clear. Avoid overly technical jargon. Use bullet points and clean structure.`;

    let prompt = `Here is the current active fleet and dispatch log:
- Total Stops: ${stops.length}
- Unassigned Stops: ${unassignedCount}
- Active Vehicles: ${vehicles.filter((v: any) => v.status === 'Active').length} / ${vehicles.length}
- Delayed Stops: ${delayedStops.length}

Fleet Performance:
${JSON.stringify(fleetSummary, null, 2)}

Delayed Stops Details:
${JSON.stringify(delayedStops, null, 2)}

Optimization Mode:
- Minimize Vehicles: ${config.minimizeVehicles}
- Traffic Aware: ${config.trafficAware}
- Time Window Penalty Weight: ${config.timeWindowWeight}
- Capacity Weight: ${config.capacityWeight}

`;

    if (customPrompt) {
      prompt += `\nThe Dispatcher (User) is asking: "${customPrompt}"\nProvide a precise, targeted answer addressing their question directly based on the routing profile above.`;
    } else {
      prompt += `\nProvide a full diagnostic analysis of this routing profile:
1. **Strategic Dispatch Overview**: Summarize fleet utilization, travel times, and overall efficiency.
2. **Efficiency Diagnosis**: Explain specific bottlenecks (e.g., if a vehicle is overloaded, if traffic zones caused late arrivals, or if time windows are too narrow).
3. **Actionable Logistics Recommendations**: Provide 3 concrete suggestions for the dispatcher (e.g., reassigning stops, adjusting shifts, modifying optimizer weights, or moving depot).`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze route profile." });
  }
});

// Vite Middleware & Static Serves
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
