from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver  
from ai_client import get_model
from langchain_community.tools import TavilySearchResults
from langchain_core.tools import tool
import yfinance as yf
from dotenv import load_dotenv
import os
import json
from datetime import datetime, timezone
from langchain.agents.middleware import SummarizationMiddleware
load_dotenv()

@tool
def get_company_financials(ticker: str) -> str:
    """Useful to get financial structure, balance sheet, and company info for a given ticker."""
    stock = yf.Ticker(ticker)
    try:
        info = stock.info
    except Exception as e:
        return f"Error fetching info for ticker {ticker}: {str(e)}"
        
    # Basic financial structure
    financials = {
        "ticker": ticker.upper(),
        "source": "Yahoo Finance",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "currency": info.get("currency"),
        "market_cap": info.get("marketCap"),
        "total_debt": info.get("totalDebt"),
        "total_cash": info.get("totalCash"),
        "debt_to_equity": info.get("debtToEquity"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "financial_currency": info.get("financialCurrency"),
        "long_business_summary": info.get("longBusinessSummary"),
        "website": info.get("website")
    }
    
    # Try to get balance sheet
    try:
        bs = stock.balance_sheet
        if not bs.empty:
            # Take the most recent year/quarter (first column)
            # Converting to string to be safe for JSON/output
            bs_summary = bs.iloc[:, 0].to_dict() 
            # Filter out None/Nan if needed, or just cast
            financials["latest_balance_sheet"] = {str(k): str(v) for k, v in bs_summary.items()}
    except Exception as e:
        financials["balance_sheet_error"] = str(e)
        
    return json.dumps(financials, default=str)


@tool
def get_market_risk(horizon: int = 21) -> str:
    """Get AlphaSharp's current S&P 500 HSMM classification and risk scenarios. Horizon is 1, 5 or 21 trading sessions."""
    from research.service import snapshot
    if horizon not in [1, 5, 21]:
        return "Choose 1, 5 or 21 trading sessions."
    return json.dumps(snapshot(horizon=horizon))


@tool
def get_stock_performance(ticker: str) -> str:
    """Get observed daily closing prices and recent returns for a stock, including the date and currency."""
    stock = yf.Ticker(ticker)
    history = stock.history(period="1y", auto_adjust=False)
    if history.empty:
        return "No price history is available for this ticker."
    close = history.Close.dropna()
    return json.dumps({"ticker": ticker.upper(), "source": "Yahoo Finance", "as_of": str(close.index[-1].date()),
                       "currency": stock.history_metadata.get("currency"),
                       "last_close": float(close.iloc[-1]),
                       "returns": {str(days)+"_sessions": float(close.iloc[-1]/close.iloc[-days-1]-1)
                                   for days in [5, 21, 63, 126] if len(close) > days}})

# Initialize the model with OpenRouter's base URL
model = get_model()
web_search = TavilySearchResults(max_results=6) if os.getenv("TAVILY_API_KEY") else None
agent = create_agent(
    model,
    tools=([web_search] if web_search else []) + [get_company_financials, get_market_risk, get_stock_performance],
    checkpointer=InMemorySaver(),  
    middleware=[
        SummarizationMiddleware(
            model=model,
            trigger=("tokens", 10000),
            keep=("messages", 10),
        ),
    ],
    system_prompt="""
    You are a financial assistant.

Your job is to provide clear, concise, and user-facing answers about stocks and companies using the latest available data.

Rules:
- NEVER reveal internal reasoning, analysis, or tool deliberation.
- Use tools (web_search, get_company_financials) when required.
- If multiple sources disagree, choose the most reputable and recent one silently.
- Respond in a structured, concise format.
- State uncertainty and missing data plainly. Include source URLs and observation dates when tools provide them.
- If data may vary intraday, say "approximately".
- Keep responses short unless the user asks for details.
- Try to refer to latest information so call tools for getting data
- For AlphaSharp market regime or risk questions, call get_market_risk. State its observation date and model ID.
- For stock performance questions, call get_stock_performance. Distinguish observed returns from future scenarios.
Output style:
- Start with a one-line summary.
- Then list key financial metrics in bullet points.

    """)
if __name__ == "__main__":
    result = agent.invoke(
        {"messages": [{"role": "user", "content": "Tell me about the company Apple financials."}]},
        {"configurable": {"thread_id": "1"}},
    )

    final_answer = result["messages"][-1].content
    print(final_answer)


