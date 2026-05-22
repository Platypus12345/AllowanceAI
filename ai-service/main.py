from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, List, Optional
import uvicorn
import os
import json
from prompt_builder import FinancialContext, build_system_prompt, check_proactive_triggers
from llm_client import llm_client, get_ai_response

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "AI Service is running", "endpoints": ["/ask", "/ask/followup", "/predict", "/tips", "/health"]}

@app.get("/health")
async def health():
    return {"status": "ok", "model": os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini")}


def convert_legacy_tools(available_tools: list) -> list:
    openai_tools = []
    for t in available_tools or []:
        name = t.get("name")
        if not name:
            continue
        props = {}
        required = []
        params = t.get("parameters") or {}
        if isinstance(params, dict):
            for key, val in params.items():
                if key in ("type", "properties", "required"):
                    continue
                desc = str(val) if not isinstance(val, dict) else val.get("description", "")
                prop_type = "string"
                if "number" in desc.lower():
                    prop_type = "number"
                prop = {"type": prop_type, "description": desc}
                props[key] = prop
                if "optional" not in desc.lower():
                    required.append(key)
        openai_tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": t.get("description", ""),
                "parameters": {
                    "type": "object",
                    "properties": props,
                    "required": required,
                },
            },
        })
    return openai_tools


class AskRequest(BaseModel):
    question: str
    allowance: float = 0
    spent: float = 0
    remaining: float = 0
    daily_limit: float = 0
    days_left: int = 10
    personality_mode: str = "supportive"
    conversation_history: List[dict] = []
    top_categories: List[Any] = []
    tools: List[Any] = []
    available_tools: Optional[list] = None
    category_breakdown: dict = {}


class FollowupRequest(BaseModel):
    original_question: str
    tool_name: str
    tool_result: Any
    pre_message: str = ""
    personality_mode: str = "supportive"
    allowance: float = 0
    spent: float = 0
    remaining: float = 0
    daily_limit: float = 0
    financial_context: dict = {}


@app.post("/ask")
async def ask_assistant(request: AskRequest):
    try:
        context = FinancialContext(
            allowance=request.allowance,
            spent=request.spent,
            remaining=request.remaining,
            daily_limit=request.daily_limit,
            days_left=request.days_left,
            personality_mode=request.personality_mode,
            category_breakdown=request.category_breakdown or {},
        )
        system_prompt = build_system_prompt(context)

        tools = request.tools or []
        if not tools and request.available_tools:
            tools = convert_legacy_tools(request.available_tools)

        messages = list(request.conversation_history or [])[-10:]
        messages.append({"role": "user", "content": request.question})

        proactive = check_proactive_triggers(
            request.category_breakdown or {},
            request.remaining,
            request.daily_limit,
            request.days_left,
        )

        if tools:
            response = await llm_client.chat_with_tools(system_prompt, messages, tools)
        else:
            response = await llm_client.chat(system_prompt, messages)

        if response.get("tool_call"):
            return {
                "type": "tool_call",
                "tool_name": response["tool_call"]["name"],
                "tool_params": response["tool_call"]["arguments"],
                "pre_message": response.get("content", ""),
                "proactive_suggestion": proactive,
            }

        content = response.get("content", "")
        return {
            "type": "text",
            "message": content,
            "answer": content,
            "proactive_suggestion": proactive,
        }
    except Exception as e:
        print(f"Error in /ask: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask/followup")
async def ask_followup(request: FollowupRequest):
    try:
        fc = request.financial_context or {}
        allowance = request.allowance or fc.get("allowance", 0)
        remaining = request.remaining if request.remaining is not None else fc.get("remaining", 0)
        daily_limit = request.daily_limit or fc.get("daily_limit", 0)

        verified = {}
        if isinstance(request.tool_result, dict):
            verified = request.tool_result.get("verified_finances") or {}
        if verified:
            allowance = verified.get("allowance", allowance)
            remaining = verified.get("remaining", remaining)
            daily_limit = verified.get("daily_limit", daily_limit)

        system = f"""You are AllowanceAI assistant.
A tool was just executed successfully.
Tool used: {request.tool_name}
Result: {json.dumps(request.tool_result, default=str)}
VERIFIED finances from database (use ONLY these numbers, do not calculate):
- Allowance: ₹{allowance}
- Spent: ₹{verified.get('spent', request.spent)}
- Remaining: ₹{remaining}
- Daily limit: ₹{daily_limit}
Respond naturally in 1-2 sentences confirming what was done. Be friendly and specific. Never invent balances."""

        response = await llm_client.chat(
            system,
            [{"role": "user", "content": f"Request was: {request.original_question}"}],
        )
        return {"message": response.get("content", "")}
    except Exception as e:
        print(f"Error in /ask/followup: {e}")
        msg = request.tool_result
        if isinstance(msg, dict):
            msg = msg.get("message", "Action completed.")
        return {"message": f"Done! {msg}"}


class PredictRequest(BaseModel):
    allowance: float
    spent: float
    remaining: float
    dailyAverage: float
    daysLeft: int
    topCategories: list

@app.post("/predict")
async def predict_spend(request: PredictRequest):
    prompt = f"""Based on these finances: Allowance: {request.allowance}, Spent: {request.spent}, Remaining: {request.remaining}, Daily Avg: {request.dailyAverage}, Days Left: {request.daysLeft}, Top Categories: {request.topCategories}.
    Provide a 2-sentence prediction of whether the user will run out of money. Then provide exactly 3 actionable tips formatted as a JSON array of strings in a 'tips' field. Output ONLY valid JSON in this format:
    {{"prediction": "text", "tips": ["tip1", "tip2", "tip3"]}}"""

    answer = await get_ai_response("You output only valid JSON.", prompt)
    try:
        return json.loads(answer)
    except json.JSONDecodeError:
        return {
            "prediction": "Your spending data is being analyzed.",
            "tips": ["Cook at home", "Cancel unused subscriptions", "Use public transport"],
        }


class TipsRequest(BaseModel):
    allowance: float
    spent: float
    remaining: float
    topCategories: list

@app.post("/tips")
async def get_tips(request: TipsRequest):
    prompt = f"""Indian college student context (mess food, auto/metro, hostels, Swiggy, Zomato).
    Finances: Allowance: {request.allowance}, Spent: {request.spent}, Remaining: {request.remaining}, Top Categories: {request.topCategories}.
    Return EXACTLY 5 specific saving tips as a JSON array of objects. Format:
    [{{"tip": "Specific actionable advice", "category": "Food/Transport/etc", "estimatedSaving": "₹XYZ"}}]
    Output ONLY valid JSON."""

    answer = await get_ai_response("You output only valid JSON.", prompt)
    try:
        tips = json.loads(answer)
        if isinstance(tips, dict) and "tips" in tips:
            tips = tips["tips"]
        return {"tips": tips}
    except json.JSONDecodeError:
        return {"tips": [
            {"tip": "Switch from Swiggy to mess food", "category": "Food", "estimatedSaving": "₹500"},
            {"tip": "Take the metro instead of auto", "category": "Transport", "estimatedSaving": "₹200"},
            {"tip": "Limit cafe visits to once a week", "category": "Entertainment", "estimatedSaving": "₹300"},
            {"tip": "Buy second-hand textbooks", "category": "Shopping", "estimatedSaving": "₹800"},
            {"tip": "Split cab rides with friends", "category": "Transport", "estimatedSaving": "₹150"},
        ]}

class WrappedNarrativeRequest(BaseModel):
    displayName: str = "Student"
    personalityMode: str = "supportive"
    stats: dict = {}


@app.post("/wrapped-narrative")
async def wrapped_narrative(request: WrappedNarrativeRequest):
    s = request.stats or {}
    prompt = f"""Write a 3-4 sentence fun, slightly roast-style monthly finance wrapped summary for {request.displayName}.
Personality tone: {request.personalityMode}.
Stats: spent ₹{s.get('totalSpent', 0)}, allowance ₹{s.get('totalAllowance', 0)}, saved ₹{s.get('savedAmount', 0)}, grade {s.get('grade', 'C')}, top category {s.get('topCategory', {}).get('name', 'Other')}, biggest splurge {s.get('biggestSplurge', {})}, compared to last month improved={s.get('comparedToLastMonth', {}).get('improved')}.
Be specific with numbers. End encouragingly."""

    try:
        answer = await get_ai_response(
            "You are AllowanceAI. Write vivid, witty wrapped summaries. No JSON.",
            prompt,
        )
        return {"narrative": answer.strip()}
    except Exception as e:
        print(f"wrapped-narrative error: {e}")
        return {
            "narrative": f"{request.displayName}, you spent ₹{s.get('totalSpent', 0):,.0f} this month. Grade {s.get('grade', 'C')}. Keep going!"
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
