"""
============================================================
  AI Travel Planner Agent — Flask + IBM watsonx.ai (Granite)
============================================================
  Customize agent behavior in the AGENT_INSTRUCTIONS section.
"""

import os
import json
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────
#  AGENT INSTRUCTIONS  (Edit here to customize agent behavior)
# ─────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = {
    # Core personality of the travel agent
    "personality": (
        "You are WanderAI, a warm, knowledgeable, and enthusiastic AI travel companion. "
        "You speak in a friendly yet professional tone, using vivid descriptions to bring "
        "destinations to life. You are culturally sensitive, inclusive, and always excited "
        "to help travelers discover the world safely and joyfully."
    ),

    # Recommendation style
    "recommendation_style": (
        "Always provide specific, actionable recommendations with reasons. "
        "Rank suggestions by value-for-money, safety, and unique experience. "
        "Include hidden gems alongside popular attractions. "
        "Tailor recommendations to the traveler's stated interests and budget tier. "
        "Use bullet points for clarity and add estimated costs where possible."
    ),

    # Travel categories the agent specializes in
    "travel_categories": [
        "Adventure & Outdoor",
        "Cultural & Heritage",
        "Beach & Relaxation",
        "Food & Culinary",
        "Wildlife & Nature",
        "Urban & City Break",
        "Family & Kids",
        "Luxury & Wellness",
        "Budget Backpacking",
        "Romantic Getaway",
        "Solo Travel",
        "Business Travel",
    ],

    # Budget optimization strategy
    "budget_strategy": (
        "Optimize itineraries for the stated budget tier: "
        "Budget (<$50/day): hostels, street food, free attractions, public transport. "
        "Mid-range ($50–$200/day): 3-star hotels, local restaurants, mix of paid/free activities. "
        "Luxury ($200+/day): boutique hotels, fine dining, private transfers, exclusive experiences. "
        "Always provide a detailed cost breakdown and flag potential hidden costs."
    ),

    # Safety rules the agent must follow
    "safety_rules": (
        "Always mention travel advisories for the destination if relevant. "
        "Recommend travel insurance for all international trips. "
        "Highlight local emergency numbers and nearest hospital/embassy locations. "
        "Flag any areas or activities with elevated risk. "
        "Provide COVID or health entry requirements when known. "
        "Never recommend illegal activities. "
        "Advise solo female travelers on safety-specific tips."
    ),

    # Packing and logistics preferences
    "packing_style": (
        "Generate packing lists based on destination climate, trip duration, and activities. "
        "Separate essentials (documents, money, meds) from clothing and gear. "
        "Recommend carry-on-only packing for trips under 7 days."
    ),

    # How to handle unknown or out-of-scope queries
    "fallback_behavior": (
        "If you cannot answer a travel question with confidence, say so honestly "
        "and suggest reliable sources like official tourism boards, Lonely Planet, or TripAdvisor. "
        "Never fabricate specific prices, visa requirements, or flight schedules."
    ),
}

# ─────────────────────────────────────────────────────────
#  App Initialization
# ─────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "wanderai-secret-2024")

# ─────────────────────────────────────────────────────────
#  IBM watsonx.ai Client Setup
# ─────────────────────────────────────────────────────────
WATSONX_API_KEY  = os.getenv("WATSONX_API_KEY", "")
WATSONX_URL      = os.getenv("WATSONX_URL", "")
WATSONX_PROJECT  = os.getenv("WATSONX_PROJECT_ID", "")
GRANITE_MODEL_ID = os.getenv("GRANITE_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")

def get_watsonx_client():
    """Create and return an IBM watsonx.ai ModelInference client."""
    credentials = Credentials(
        url=WATSONX_URL,
        api_key=WATSONX_API_KEY,
    )
    client = APIClient(credentials=credentials, project_id=WATSONX_PROJECT)
    model = ModelInference(
        model_id=GRANITE_MODEL_ID,
        api_client=client,
        params={
            GenParams.MAX_NEW_TOKENS: 1500,
            GenParams.MIN_NEW_TOKENS: 50,
            GenParams.TEMPERATURE: 0.7,
            GenParams.TOP_P: 0.9,
            GenParams.TOP_K: 50,
            GenParams.REPETITION_PENALTY: 1.1,
        },
    )
    return model


def build_system_prompt():
    """Assemble a system prompt from AGENT_INSTRUCTIONS."""
    inst = AGENT_INSTRUCTIONS
    categories = ", ".join(inst["travel_categories"])
    return f"""
{inst['personality']}

RECOMMENDATION STYLE:
{inst['recommendation_style']}

TRAVEL CATEGORIES YOU SPECIALISE IN:
{categories}

BUDGET STRATEGY:
{inst['budget_strategy']}

SAFETY RULES:
{inst['safety_rules']}

PACKING GUIDELINES:
{inst['packing_style']}

FALLBACK BEHAVIOR:
{inst['fallback_behavior']}

RESPONSE FORMAT:
- Use Markdown-style formatting (bold **text**, bullet lists, numbered lists).
- Always end responses with a helpful follow-up question or next-step suggestion.
- Keep responses concise yet comprehensive — aim for 250–600 words unless a full itinerary is requested.
""".strip()


def _build_prompt(system_prompt: str, messages: list[dict]) -> str:
    """
    Build the correctly-formatted prompt string for the active model.

    Supported formats (auto-detected from GRANITE_MODEL_ID):
      • Llama 3.x  — <|begin_of_text|><|start_header_id|>…<|end_header_id|>…<|eot_id|>
      • Granite     — <|system|> / <|user|> / <|assistant|>
      • Mistral     — [INST] … [/INST]
      • Fallback    — plain "System: / User: / Assistant:" labels
    """
    model_id = GRANITE_MODEL_ID.lower()

    # ── Llama 3.x instruct format ──
    if "llama-3" in model_id or "llama-4" in model_id:
        prompt = "<|begin_of_text|>"
        prompt += f"<|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
        for msg in messages:
            role    = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                prompt += f"<|start_header_id|>{role}<|end_header_id|>\n\n{content}<|eot_id|>"
        prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n"
        return prompt

    # ── Mistral / Mixtral instruct format ──
    if "mistral" in model_id or "mixtral" in model_id:
        # Mistral uses [INST] … [/INST]; system message prepended to first user turn
        prompt = ""
        system_injected = False
        for msg in messages:
            role    = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                user_text = f"{system_prompt}\n\n{content}" if not system_injected else content
                system_injected = True
                prompt += f"[INST] {user_text} [/INST]"
            elif role == "assistant":
                prompt += f" {content}</s>"
        if not system_injected:
            prompt += f"[INST] {system_prompt} [/INST]"
        return prompt

    # ── IBM Granite instruct format ──
    if "granite" in model_id:
        prompt = f"<|system|>\n{system_prompt}\n"
        for msg in messages:
            role    = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                prompt += f"<|user|>\n{content}\n"
            elif role == "assistant":
                prompt += f"<|assistant|>\n{content}\n"
        prompt += "<|assistant|>\n"
        return prompt

    # ── Generic fallback ──
    prompt = f"System: {system_prompt}\n\n"
    for msg in messages:
        role    = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            prompt += f"User: {content}\n"
        elif role == "assistant":
            prompt += f"Assistant: {content}\n"
    prompt += "Assistant:"
    return prompt


def call_granite(messages: list[dict]) -> str:
    """Send messages to the configured watsonx.ai model and return the reply."""
    try:
        model         = get_watsonx_client()
        system_prompt = build_system_prompt()
        conversation  = _build_prompt(system_prompt, messages)

        response = model.generate_text(prompt=conversation)
        return response.strip() if isinstance(response, str) else str(response)
    except Exception as exc:  # noqa: BLE001
        return f"⚠️ WanderAI encountered an error: {exc}"


# ─────────────────────────────────────────────────────────
#  Helper: extract structured data from model response
# ─────────────────────────────────────────────────────────
def extract_json_block(text: str) -> dict | None:
    """Try to extract a JSON block embedded in a model response."""
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


# ─────────────────────────────────────────────────────────
#  Page Routes
# ─────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat")
def chat():
    return render_template("chat.html")


@app.route("/dashboard")
def dashboard():
    trip_data = session.get("trip_data", {})
    return render_template("dashboard.html", trip_data=trip_data)


@app.route("/itinerary")
def itinerary():
    return render_template("itinerary.html")


@app.route("/budget")
def budget():
    return render_template("budget.html")


@app.route("/profile")
def profile():
    return render_template("profile.html")


# ─────────────────────────────────────────────────────────
#  API: Chat Endpoint
# ─────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    history      = data.get("history", [])  # list of {role, content}

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Append new user message to history
    history.append({"role": "user", "content": user_message})

    reply = call_granite(history)

    # Persist latest trip context in session if we find a JSON block
    json_block = extract_json_block(reply)
    if json_block:
        session["trip_data"] = json_block

    return jsonify({
        "reply": reply,
        "timestamp": datetime.now().strftime("%H:%M"),
    })


# ─────────────────────────────────────────────────────────
#  API: Generate Full Itinerary
# ─────────────────────────────────────────────────────────
@app.route("/api/itinerary", methods=["POST"])
def api_itinerary():
    data = request.get_json(silent=True) or {}
    required = ["destination", "days", "budget", "interests"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    destination  = data["destination"]
    days         = data["days"]
    budget       = data["budget"]
    interests    = data["interests"]
    travelers    = data.get("travelers", 1)
    transport    = data.get("transport", "flexible")
    accommodation= data.get("accommodation", "hotel")

    prompt = (
        f"Create a detailed {days}-day travel itinerary for {destination}.\n"
        f"Budget tier: {budget}\n"
        f"Number of travelers: {travelers}\n"
        f"Interests: {interests}\n"
        f"Transport preference: {transport}\n"
        f"Accommodation preference: {accommodation}\n\n"
        "Structure your response EXACTLY as follows:\n"
        "1. **Trip Overview** – 2-sentence summary\n"
        "2. **Day-by-Day Itinerary** – For each day: morning, afternoon, evening activities with estimated costs\n"
        "3. **Budget Breakdown** – Categories with amounts (accommodation, food, transport, activities, misc)\n"
        "4. **Top Accommodation Options** – 3 options with price range and why\n"
        "5. **Getting Around** – Transport options within destination\n"
        "6. **Must-Try Foods** – 5 local dishes/restaurants\n"
        "7. **Packing List** – Destination-specific essentials\n"
        "8. **Safety & Travel Tips** – 5 key tips\n"
    )

    messages = [{"role": "user", "content": prompt}]
    reply = call_granite(messages)

    # Save to session
    session["trip_data"] = {
        "destination": destination,
        "days": days,
        "budget": budget,
        "interests": interests,
        "travelers": travelers,
        "itinerary_text": reply,
        "generated_at": datetime.now().isoformat(),
    }

    return jsonify({
        "itinerary": reply,
        "destination": destination,
        "days": days,
        "generated_at": datetime.now().strftime("%B %d, %Y"),
    })


# ─────────────────────────────────────────────────────────
#  API: Budget Planner
# ─────────────────────────────────────────────────────────
@app.route("/api/budget", methods=["POST"])
def api_budget():
    data = request.get_json(silent=True) or {}
    destination  = data.get("destination", "")
    days         = data.get("days", 7)
    travelers    = data.get("travelers", 1)
    budget_total = data.get("budget_total", 0)
    style        = data.get("travel_style", "mid-range")

    prompt = (
        f"Create a detailed travel budget plan for {destination}.\n"
        f"Duration: {days} days, {travelers} traveler(s)\n"
        f"Total budget: ${budget_total} USD\n"
        f"Travel style: {style}\n\n"
        "Provide:\n"
        "1. **Daily Budget Breakdown** – Per person per day for: accommodation, food, transport, activities, shopping, misc\n"
        "2. **Total Trip Cost Estimate** – Best case, expected, and worst case scenarios\n"
        "3. **Money-Saving Tips** – 5 specific tips for this destination\n"
        "4. **Currency & Payment Tips** – Local currency, exchange tips, card acceptance\n"
        "5. **Budget vs Actual Tracker Template** – Simple table format\n"
        "Include estimated costs in both USD and local currency where possible."
    )

    messages = [{"role": "user", "content": prompt}]
    reply = call_granite(messages)

    return jsonify({
        "budget_plan": reply,
        "destination": destination,
        "total_budget": budget_total,
    })


# ─────────────────────────────────────────────────────────
#  API: Destination Recommendations
# ─────────────────────────────────────────────────────────
@app.route("/api/recommendations", methods=["POST"])
def api_recommendations():
    data = request.get_json(silent=True) or {}
    interests    = data.get("interests", "general travel")
    budget       = data.get("budget", "mid-range")
    duration     = data.get("duration", "1 week")
    season       = data.get("season", "any")
    from_country = data.get("from_country", "")

    prompt = (
        f"Recommend 6 travel destinations for someone who loves: {interests}.\n"
        f"Budget: {budget}, Trip duration: {duration}, Preferred season: {season}\n"
        f"Departing from: {from_country or 'anywhere'}\n\n"
        "For each destination provide:\n"
        "- **Destination Name, Country**\n"
        "- Why it matches the traveler's interests (2 sentences)\n"
        "- Best time to visit\n"
        "- Estimated daily budget\n"
        "- Top 3 must-do activities\n"
        "- One hidden gem tip\n"
        "- Safety rating (1-5 stars)\n"
        "\nSeparate each destination with a horizontal rule (---)."
    )

    messages = [{"role": "user", "content": prompt}]
    reply = call_granite(messages)

    return jsonify({"recommendations": reply})


# ─────────────────────────────────────────────────────────
#  API: Save / Load Profile
# ─────────────────────────────────────────────────────────
@app.route("/api/profile", methods=["GET", "POST"])
def api_profile():
    if request.method == "POST":
        profile_data = request.get_json(silent=True) or {}
        session["user_profile"] = profile_data
        return jsonify({"status": "saved", "profile": profile_data})

    profile = session.get("user_profile", {})
    return jsonify({"profile": profile})


# ─────────────────────────────────────────────────────────
#  API: Weather & Travel Advisory (via Granite knowledge)
# ─────────────────────────────────────────────────────────
@app.route("/api/weather-advice", methods=["POST"])
def api_weather_advice():
    data        = request.get_json(silent=True) or {}
    destination = data.get("destination", "")
    month       = data.get("month", datetime.now().strftime("%B"))

    prompt = (
        f"Provide weather and climate advice for traveling to {destination} in {month}.\n"
        "Include:\n"
        "1. **Weather Overview** – Temperature range, rainfall, humidity\n"
        "2. **What to Pack** – Climate-specific clothing and gear\n"
        "3. **Weather-Related Activities** – Best activities for this season\n"
        "4. **Weather Warnings** – Monsoon, typhoon, extreme heat, etc.\n"
        "5. **Best Micro-regions** – Where to go within the destination in this season\n"
    )

    messages = [{"role": "user", "content": prompt}]
    reply = call_granite(messages)

    return jsonify({"weather_advice": reply, "destination": destination, "month": month})


# ─────────────────────────────────────────────────────────
#  API: Quick Trip Stats for Dashboard
# ─────────────────────────────────────────────────────────
@app.route("/api/trip-stats", methods=["GET"])
def api_trip_stats():
    trip_data = session.get("trip_data", {})
    return jsonify({"trip_data": trip_data})


# ─────────────────────────────────────────────────────────
#  API: Health Check
# ─────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def api_health():
    env_ok = bool(WATSONX_API_KEY and WATSONX_PROJECT)
    return jsonify({
        "status": "ok",
        "model": GRANITE_MODEL_ID,
        "env_configured": env_ok,
        "timestamp": datetime.now().isoformat(),
    })


# ─────────────────────────────────────────────────────────
#  Error Handlers
# ─────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return render_template("index.html"), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "detail": str(e)}), 500


# ─────────────────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    port = int(os.getenv("PORT", 5000))
    print(f"🌍 WanderAI Travel Agent starting on http://localhost:{port}")
    print(f"   Model  : {GRANITE_MODEL_ID}")
    print(f"   Project: {WATSONX_PROJECT or '⚠ Not set'}")
    app.run(debug=debug_mode, host="0.0.0.0", port=port)
