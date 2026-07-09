# ✈️ WanderAI — AI-Powered Travel Planner

> A full-stack Flask web application powered by **IBM watsonx.ai** and **IBM Granite** foundation models.
> Plan trips, generate itineraries, manage budgets, and get personalised travel advice — all through an intelligent AI companion.

---

## 📸 Features at a Glance

| Feature | Description |
|---|---|
| 🤖 **AI Travel Chat** | Conversational travel planning with IBM Granite |
| 🗓️ **Itinerary Planner** | Day-by-day AI-generated itineraries |
| 💰 **Budget Planner** | Smart budget breakdown & money-saving tips |
| 📊 **Travel Dashboard** | Full trip overview — itinerary, budget, weather, checklist |
| 👤 **Travel Profile** | Save preferences for personalised recommendations |
| 🌙 **Dark Mode** | Full light/dark theme toggle |
| 📱 **Responsive** | Mobile-first, Bootstrap 5 layout |

---

## 🏗️ Project Structure

```
TravelAgent/
├── app.py                    # Flask app + IBM watsonx.ai integration + AGENT_INSTRUCTIONS
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
├── .env                      # Your credentials (NOT committed to git)
│
├── templates/
│   ├── base.html             # Shared layout: navbar, footer, dark mode
│   ├── index.html            # Landing page with features, how-it-works
│   ├── chat.html             # AI chat interface with sidebar
│   ├── dashboard.html        # Travel dashboard with KPIs & widgets
│   ├── itinerary.html        # Itinerary builder form + AI result
│   ├── budget.html           # Budget planner with slider
│   └── profile.html          # User profile & preferences
│
└── static/
    ├── css/
    │   └── style.css         # Full design system (tokens, components, dark mode)
    └── js/
        ├── main.js           # Dark mode, toast system, markdown renderer
        ├── chat.js           # Chat logic, history, context modes
        └── dashboard.js      # Dashboard population, checklist, weather
```

---

## ⚙️ Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Landing page |
| `GET` | `/chat` | AI chat interface |
| `GET` | `/dashboard` | Travel dashboard |
| `GET` | `/itinerary` | Itinerary planner |
| `GET` | `/budget` | Budget planner |
| `GET` | `/profile` | User profile |
| `POST` | `/api/chat` | Send message to IBM Granite |
| `POST` | `/api/itinerary` | Generate full itinerary |
| `POST` | `/api/budget` | Generate budget plan |
| `POST` | `/api/recommendations` | Get destination recommendations |
| `POST` | `/api/weather-advice` | Get weather & season advice |
| `GET/POST` | `/api/profile` | Save/load user profile |
| `GET` | `/api/trip-stats` | Fetch saved trip from session |
| `GET` | `/api/health` | Health check & env validation |

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.10+
- An [IBM Cloud account](https://cloud.ibm.com/registration)
- An [IBM watsonx.ai](https://www.ibm.com/products/watsonx-ai) project

### 2. Clone & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd TravelAgent

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your credentials
notepad .env          # Windows
nano .env             # macOS/Linux
```

Fill in these required values in `.env`:

```env
WATSONX_API_KEY=your_ibm_cloud_api_key_here
WATSONX_URL=your_watsonx_url_here
WATSONX_PROJECT_ID=your_project_id_here
GRANITE_MODEL_ID=ibm/granite-3-8b-instruct
FLASK_SECRET_KEY=your_random_secret_key_here
FLASK_DEBUG=True
PORT=5000
```

### 4. Get IBM watsonx.ai Credentials

1. Log in to [IBM Cloud](https://cloud.ibm.com)
2. Create a **watsonx.ai** service instance
3. Go to **Projects** → Create or select a project
4. Copy the **Project ID** from the project settings
5. Go to **Manage** → **Access (IAM)** → **API Keys** → Create an API key
6. Copy the API key into your `.env` file

### 5. Run the App

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🛠️ Customising the Agent

The **`AGENT_INSTRUCTIONS`** dictionary at the top of [`app.py`](app.py) controls every aspect of WanderAI's personality and behaviour:

```python
AGENT_INSTRUCTIONS = {
    "personality": "...",           # Agent's name, tone, communication style
    "recommendation_style": "...",  # How recommendations are structured
    "travel_categories": [...],     # Specialisation areas
    "budget_strategy": "...",       # Budget tier logic
    "safety_rules": "...",          # Safety & advisory requirements
    "packing_style": "...",         # Packing list generation style
    "fallback_behavior": "...",     # How to handle unknown queries
}
```

**Example customisations:**

```python
# Make the agent more adventurous
"personality": "You are Max, an extreme adventure travel expert...",

# Focus on luxury travel
"budget_strategy": "Always recommend 5-star hotels and fine dining experiences...",

# Add a new travel category
"travel_categories": [..., "Space Tourism", "Culinary Tours"],
```

---

## 🤖 Supported IBM Granite Models

| Model ID | Description |
|---|---|
| `ibm/granite-3-8b-instruct` | ✅ **Recommended** — Fast, capable, great for chat |
| `ibm/granite-3-2b-instruct` | Lighter model, faster responses |
| `ibm/granite-13b-instruct-v2` | Larger, more detailed responses |

Change the model by updating `GRANITE_MODEL_ID` in your `.env` file.

---

## 🌐 Deployment

### Option A — Gunicorn (Production)

```bash
# Install gunicorn (already in requirements.txt)
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option B — Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t wanderai .
docker run -p 5000:5000 --env-file .env wanderai
```

### Option C — IBM Code Engine

```bash
# Install IBM Cloud CLI + Code Engine plugin
ibmcloud login
ibmcloud ce project create --name wanderai
ibmcloud ce application create \
  --name wanderai \
  --image icr.io/yourns/wanderai:latest \
  --env-from-secret wanderai-secrets \
  --port 5000
```

### Option D — Heroku / Render / Railway

1. Set all environment variables in the platform's dashboard
2. Set start command: `gunicorn app:app`
3. Deploy from GitHub

---

## 🔒 Security Notes

- **Never** commit your `.env` file — it's listed in `.gitignore` by default
- The `FLASK_SECRET_KEY` should be a long random string (32+ characters)
- Set `FLASK_DEBUG=False` in production
- For production, use HTTPS behind a reverse proxy (nginx/caddy)
- IBM watsonx.ai API keys should have minimal required permissions

---

## 🧩 Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.10+, Flask 3.0 |
| **AI / LLM** | IBM watsonx.ai, IBM Granite 3.x |
| **Frontend** | HTML5, CSS3, JavaScript (ES2020) |
| **UI Framework** | Bootstrap 5.3 |
| **Icons** | Bootstrap Icons 1.11 |
| **Fonts** | Inter, Playfair Display (Google Fonts) |
| **Config** | python-dotenv |
| **WSGI** | Gunicorn |

---

## 🐛 Troubleshooting

**`WatsonX credentials not configured` warning**
→ Ensure `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are set in your `.env` file.

**`ModuleNotFoundError: No module named 'ibm_watsonx_ai'`**
→ Run `pip install -r requirements.txt` inside your virtual environment.

**`401 Unauthorized` from IBM API**
→ Check your API key is active and has access to the watsonx.ai service.

**`404 Project not found`**
→ Verify your `WATSONX_PROJECT_ID` matches the project in IBM Cloud.

**Chat returns empty responses**
→ Try a different `GRANITE_MODEL_ID` — some models may not be available in all regions.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙌 Built With

- [IBM watsonx.ai](https://www.ibm.com/products/watsonx-ai) — Enterprise AI platform
- [IBM Granite](https://www.ibm.com/granite) — Foundation models by IBM Research
- [Flask](https://flask.palletsprojects.com) — Python web framework
- [Bootstrap 5](https://getbootstrap.com) — Responsive UI framework
