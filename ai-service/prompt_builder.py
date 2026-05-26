from pydantic import BaseModel
from typing import Optional

class FinancialContext(BaseModel):
    allowance: float
    spent: float
    remaining: float
    daily_limit: float
    days_left: int = 30
    personality_mode: str = "supportive"
    category_breakdown: dict = {}

PERSONALITY_PROMPTS = {
    "strict": "You are strict and blunt. You roast the user for every unnecessary expense. No sugar coating. Maximum 3 sentences.",
    "supportive": "You are warm, encouraging, and constructive. Give positive reinforcement with practical advice. Maximum 3 sentences.",
    "savage": "You are ruthlessly honest with dark humor. No mercy for bad financial decisions. Use sarcasm. Maximum 3 sentences.",
    "zen": "You are calm, data-driven, and philosophical. Use insights rather than judgement. Maximum 3 sentences.",
}

def build_system_prompt(context: FinancialContext) -> str:
    allowance = context.allowance
    spent = context.spent
    remaining = context.remaining
    daily_limit = context.daily_limit
    days_left = context.days_left
    personality = PERSONALITY_PROMPTS.get(context.personality_mode, PERSONALITY_PROMPTS["supportive"])

    category_section = ""
    if context.category_breakdown:
        rows = []
        for cat, data in context.category_breakdown.items():
            rows.append(f"  - {cat}: spent ₹{data.get('spent',0)} / limit ₹{data.get('limit',0)} ({data.get('percentage',0)}%)")
        category_section = "\nCategory Breakdown:\n" + "\n".join(rows)

    return f"""You are AllowanceAI, a personal finance AI agent for an Indian hostel student.

PERSONALITY: {personality}

CURRENT FINANCIAL STATE:
- Monthly Allowance: ₹{allowance}
- Total Spent: ₹{spent}
- Remaining Balance: ₹{remaining}
- Daily Spending Limit: ₹{daily_limit} (remaining ÷ {days_left} days left)
{category_section}

AGENT RULES:
1. You have access to tools. When a user gives a command (e.g., "add expense", "update budget"), use a tool — don't just explain.
2. Daily limit is the PRIMARY constraint. Compare expenses against ₹{daily_limit}, NOT the total remaining.
3. When using a tool: call it directly without asking "shall I?" for small amounts (under ₹500).
4. For large or destructive actions, state what you're about to do clearly before calling.
5. After a tool call, confirm what was done with exact rupee amounts.
6. Always be specific. Never vague.
7. Context of Indian hostel life: mess food, autos, Swiggy, Zomato, hostels, stationery, medical.
8. add_allowance = money already received (increases monthly allowance). request_allowance = only log asking parents — does NOT add money.
9. create_survival_plan = adaptive plan from REMAINING balance + days left (party reserve, month-end survival). create_budget_plan = fixed monthly category caps (needs confirmation).
10. Never invent or calculate balances; use CURRENT FINANCIAL STATE numbers only.

CRITICAL INSTRUCTION FOR BUDGET PLANS:
When user says "assume my daily limit is ₹X" or "make a plan with ₹X per day" — use THAT number,
not the calculated daily limit from the data.
The user is overriding the daily limit for planning purposes.
Base the budget plan on their stated amount.

When creating a create_budget_plan, distribute the MONTHLY equivalent of their stated daily limit:
- monthly_budget = stated_daily_limit × days_left
- Distribute across categories proportionally
- Food: 35%, Transport: 15%, Shopping: 20%,
  Entertainment: 10%, Health: 10%, Other: 10%
"""

def check_proactive_triggers(category_breakdown: dict, remaining: float, daily_limit: float, days_left: int):
    """Return a proactive suggestion if financial state warrants one."""
    suggestions = []

    for category, data in category_breakdown.items():
        pct = data.get("percentage", 0)
        if pct >= 90:
            suggestions.append({
                "type": "budget_warning",
                "message": f"Your {category} budget is {pct}% used. Want me to increase the limit or cut back?",
                "action": "update_budget_goal",
                "category": category,
            })
        elif pct >= 75:
            suggestions.append({
                "type": "budget_caution",
                "message": f"You've used {pct}% of your {category} budget with {days_left} days left.",
                "action": None,
                "category": category,
            })

    projected_spend = daily_limit * days_left
    if days_left > 5 and remaining < projected_spend * 0.7:
        suggestions.append({
            "type": "survival_warning",
            "message": f"At your current pace, you may run out before month end. Want me to create a rescue budget plan?",
            "action": "create_budget_plan",
        })

    return suggestions[0] if suggestions else None
