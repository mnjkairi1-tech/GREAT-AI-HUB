import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// A curated library of stunningly beautiful, ultra-high-quality Unsplash image URLs for food and service items
const CuratedImageLibrary: { [key: string]: string } = {
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop",
  pasta: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?q=80&w=600&auto=format&fit=crop",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=600&auto=format&fit=crop",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop",
  roll: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?q=80&w=600&auto=format&fit=crop",
  fry: "https://images.unsplash.com/photo-1576107232684-1279f390859f?q=80&w=600&auto=format&fit=crop",
  samosa: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=600&auto=format&fit=crop",
  chaat: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop",
  chicken: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?q=80&w=600&auto=format&fit=crop",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=600&auto=format&fit=crop",
  curry: "https://images.unsplash.com/photo-1545247181-516773cae7be?q=80&w=600&auto=format&fit=crop",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=600&auto=format&fit=crop",
  tea: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=600&auto=format&fit=crop",
  chai: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=600&auto=format&fit=crop",
  shake: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=600&auto=format&fit=crop",
  cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop",
  dessert: "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=600&auto=format&fit=crop",
  icecream: "https://images.unsplash.com/photo-1501443762594-e2bc00ac7338?q=80&w=600&auto=format&fit=crop",
  hair: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=600&auto=format&fit=crop",
  face: "https://images.unsplash.com/photo-1561230687-c89073471c90?q=80&w=600&auto=format&fit=crop",
  spa: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=600&auto=format&fit=crop",
  massage: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=600&auto=format&fit=crop",
  consultation: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?q=80&w=600&auto=format&fit=crop",
  diagnostic: "https://images.unsplash.com/photo-1579684389781-71d1793a86d7?q=80&w=600&auto=format&fit=crop",
  treatment: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?q=80&w=600&auto=format&fit=crop",
  manicure: "https://images.unsplash.com/photo-1604654894611-6973b376cbde?q=80&w=600&auto=format&fit=crop",
  pedicure: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=600&auto=format&fit=crop",
  makeup: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=600&auto=format&fit=crop",
  bridal: "https://images.unsplash.com/photo-1594744803329-e58b31de215f?q=80&w=600&auto=format&fit=crop",
  shave: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600&auto=format&fit=crop",
  crepes: "https://images.unsplash.com/photo-1519676867240-f03562e64548?q=80&w=600&auto=format&fit=crop",
  tacos: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=600&auto=format&fit=crop"
};

// Help map name directly using lookup or find best match keyword
function getImageUrlForProduct(name: string, businessType: string): string {
  const cleanName = name.toLowerCase();
  
  // Try exact keyword keys
  for (const keyword of Object.keys(CuratedImageLibrary)) {
    if (cleanName.includes(keyword)) {
      return CuratedImageLibrary[keyword];
    }
  }

  // Fallback defaults based on business categories
  const bType = businessType.toLowerCase();
  if (bType.includes("salon")) {
    return CuratedImageLibrary.hair;
  } else if (bType.includes("clinic")) {
    return CuratedImageLibrary.treatment;
  } else {
    // Default food plate
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop";
  }
}

// REST API for Gemini AI Quick Autofill
app.post("/api/gemini/generate-menu-item", async (req, res) => {
  const { itemName, price, businessType } = req.body;

  if (!itemName) {
    return res.status(400).json({ error: "Item name is required" });
  }

  try {
    const isPaidModelNeeded = false; // We use gemini-3.5-flash which is free and fast!
    const prompt = `You are a professional copywriter mapping products/services for a "${businessType}".
Analyze the item/service called "${itemName}".
Fill in other beautiful properties like category recommendation, and a beautiful short commercial description (12-23 words).

Choose the single most appropriate category:
- For Salon businessType: choose one of ["Hair", "Face", "Spa & Massage", "Other Services"]
- For Clinic businessType: choose one of ["Consultation", "Diagnostics", "Treatment", "Other Services"]
- For any other businessType (Food etc): choose one of ["Main Course", "Snacks", "Drinks", "Desserts"]

Provide:
1. "name": Formatted beautifully with initial caps (e.g. "Veg Burger", "Full Body Massage").
2. "price": Suggested price in Rupees (INR) as a number (use ${price ? parseInt(price) : 199} if provided, else suggest a reasonable mid-range market price).
3. "category": The exact category selected from the list above.
4. "description": A sensory-rich, professional, tasting/service description. Make it sound premium!
5. "volume": If it is a drink/beverage, recommend standard like "300 ml", else leave blank "".
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            price: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            volume: { type: Type.STRING }
          },
          required: ["name", "price", "category", "description"]
        }
      }
    });

    const bodyText = response.text || "{}";
    const data = JSON.parse(bodyText.trim());
    
    // Auto-map high resolution stock imagery
    data.imageUrl = getImageUrlForProduct(data.name || itemName, businessType);
    
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Quick Add Error:", error);
    res.status(500).json({ error: error?.message || "Internal generation failed" });
  }
});

// Vite middleware for development
let startPromise: Promise<void> | undefined;
if (process.env.NODE_ENV !== "production") {
  startPromise = createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const start = async () => {
  if (startPromise) await startPromise;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();
