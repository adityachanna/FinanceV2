import os
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import modules
import details
import market_runtime as hsmm_api
from research import service as research_service
from ai_client import configured, content_text
import fallback
from news_service import company_news

import requests

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AlphaSharp market research API",
    description="Three-state explicit-duration HSMM, historical replay, evaluated risk scenarios, stock data and optional OpenRouter explanations.",
    version="3.0.0"
)

# CORS Config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class AgentQuery(BaseModel):
    query: str
    thread_id: str = "default_thread"

class MarketBriefRequest(BaseModel):
    pulse: Dict[str, Any]
    regime: Dict[str, Any]
    headlines: List[Dict[str, Any]] = []

class CombinedResponse(BaseModel):
    ticker: str
    timestamp: str
    stock_analysis: Optional[Dict[str, Any]] = None
    market_news: Optional[Dict[str, Any]] = None
    market_regime: Optional[Dict[str, Any]] = None
    regime_forecast: Optional[Dict[str, Any]] = None


class ResearchBriefRequest(BaseModel):
    snapshot_id: str
    as_of: Optional[str] = None
    horizon: int = 21


def research_error(error):
    if isinstance(error, FileNotFoundError):
        return HTTPException(status_code=503, detail=str(error))
    if isinstance(error, ValueError):
        return HTTPException(status_code=400, detail=str(error))
    logger.exception("Research request failed")
    return HTTPException(status_code=500, detail="Research data could not be loaded")


@app.get("/api/research/snapshot", tags=["Research"])
def get_research_snapshot(as_of: Optional[str] = None, horizon: int = Query(21, ge=1, le=120)):
    try:
        return research_service.snapshot(as_of, horizon)
    except Exception as error:
        raise research_error(error)


@app.get("/api/research/replay", tags=["Research"])
def get_research_replay(as_of: str, horizon: int = Query(21, ge=1, le=21), reveal: bool = False):
    try:
        return research_service.replay(as_of, horizon, reveal)
    except Exception as error:
        raise research_error(error)


@app.get("/api/research/evaluation", tags=["Research"])
def get_research_evaluation():
    return research_service.evaluation()


@app.post("/api/research/brief", tags=["Research"])
def get_research_brief(request: ResearchBriefRequest):
    try:
        snapshot = research_service.snapshot(request.as_of, request.horizon)
        if snapshot["snapshot_id"] != request.snapshot_id:
            raise ValueError("The snapshot changed. Refresh the data before requesting a brief.")
    except Exception as error:
        raise research_error(error)
    if not configured():
        return {"brief": fallback.market_text(snapshot), "snapshot_id": snapshot["snapshot_id"], "model": "built-in", "fallback": True}
    try:
        response = details.model.invoke(
            "Explain this AlphaSharp research snapshot in under 160 words. Use only these facts. "
            "Preserve dates, units and uncertainty. Do not add current news or recommendations. "
            "Cite the snapshot ID and model ID. Values in risk and fan are decimal returns, not percentages. "
            + __import__('json').dumps(snapshot))
        return {"brief": content_text(response.content), "snapshot_id": snapshot["snapshot_id"],
                "model": os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini")}
    except Exception as error:
        logger.warning(f"AI brief failed, using built-in analyst: {error}")
        return {"brief": fallback.market_text(snapshot), "snapshot_id": snapshot["snapshot_id"], "model": "built-in", "fallback": True}


@app.post("/api/stock/{ticker}/explain", tags=["Stock Analysis"])
def explain_stock(ticker: str):
    raw = details.get_stock_details(ticker)
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])
    if configured():
        text = details.explain_stock_metrics(raw)
        if not text.startswith(("Error generating", "Unable to analyze")):
            return {"explanation": text, "as_of": raw.get("timestamp"), "source": "Yahoo Finance"}
    return {"explanation": fallback.stock_metrics_text(raw), "as_of": raw.get("timestamp"),
            "source": "Yahoo Finance", "fallback": True}

# --- Endpoints ---

@app.get("/api/ai/status", tags=["Health"])
def ai_status():
    ai = configured()
    return {"configured": ai, "available": True, "mode": "ai" if ai else "built-in",
            "model": os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini") if ai else "built-in data analyst"}

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "online", "service": "Financial Intelligence API v2.0 (HSMM)", "timestamp": datetime.now().isoformat()}

# 1. Stock Details & Analysis (from details.py)
@app.get("/api/stock/{ticker}/analysis", tags=["Stock Analysis"])
def get_stock_analysis(ticker: str):
    """Get complete stock analysis including fundamentals, peers, and AI insights."""
    try:
        raw = details.get_stock_details(ticker)
        if "error" in raw:
            raise HTTPException(status_code=502, detail=raw["error"])
        return {"ticker": ticker.upper(), "raw_details": raw, "timestamp": raw.get("timestamp"),
                "metrics_explanation": None, "peer_comparison": None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in stock analysis for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{ticker}/news", tags=["Stock Analysis"])
def get_stock_news(ticker: str, max_items: int = Query(5, ge=1, le=20)):
    """Get publisher headlines without an AI call."""
    try:
        return company_news(ticker, max_items)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in news for {ticker}: {e}")
        raise HTTPException(status_code=502, detail="Yahoo Finance news is temporarily unavailable. Try refreshing shortly.")

# ============================================
# 2. HSMM Market Regime Endpoints (NEW)
# ============================================

@app.get("/api/market/condition", tags=["Market Regime (HSMM)"])
def get_market_condition():
    """
    Get current HSMM-based market regime.
    
    The model analyzes S&P 500 to determine the overall market state.
    Returns one of three model-defined volatility states.
    
    Includes:
    - Current regime ID and label
    - S&P 500 price and VIX level
    - Historical characteristics of this regime (avg return, volatility, duration)
    - Model metadata
    """
    try:
        return hsmm_api.get_market_condition()
    except Exception as e:
        logger.error(f"Error in market condition: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/forecast", tags=["Market Regime (HSMM)"])
def get_market_forecast(
    days: int = Query(default=21, ge=1, le=120, description="Forecast horizon in trading sessions"),
    simulations: int = Query(default=2000, ge=100, le=10000, description="Number of Monte Carlo simulations"),
    include_paths: bool = Query(default=False, description="Include sample price paths for charting")
):
    """
    Get HSMM-based Monte Carlo price forecast.
    
    Uses the current market regime and Semi-Markov transition dynamics to 
    simulate thousands of possible future price paths.
    
    Returns:
    - Expected price and return
    - Bull case (95th percentile) and Bear case (5th percentile)
    - Model scenario intervals (50% and 90%)
    - Optionally: Mean path and sample paths for visualization
    """
    try:
        return hsmm_api.get_regime_forecast(
            horizon_days=days,
            n_simulations=simulations,
            include_paths=include_paths
        )
    except Exception as e:
        logger.error(f"Error in forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/forecast/short-term", tags=["Market Regime (HSMM)"])
def get_short_term_forecast(
    days: int = Query(default=5, ge=1, le=10, description="Prediction horizon (1-10 days)")
):
    """
    Get short-term price prediction with daily estimates.
    
    Useful for near-term trading decisions. Returns:
    - Daily expected price
    - Price range (25th-75th percentile)
    - Overall expected return
    - Best/worst case scenarios
    """
    try:
        return hsmm_api.get_short_term_prediction(days=days)
    except Exception as e:
        logger.error(f"Error in short-term forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/regimes", tags=["Market Regime (HSMM)"])
def get_all_regimes():
    """
    Get information about all possible market regimes.
    
    Returns detailed statistics for each model state including:
    - Expected annual return and volatility
    - Average duration in days
    - Historical frequency
    - Average VIX level
    """
    try:
        return hsmm_api.get_all_regimes()
    except Exception as e:
        logger.error(f"Error getting regimes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/history", tags=["Market Regime (HSMM)"])
def get_regime_history(
    days: int = Query(default=60, ge=10, le=750, description="Number of days of history (max 750 = ~3 years)")
):
    """
    Get historical regime classifications.
    
    Returns daily regime data for charting regime transitions over time.
    Includes date, price, VIX, and regime classification for each day.
    """
    try:
        return hsmm_api.get_regime_history(days_back=days)
    except Exception as e:
        logger.error(f"Error getting regime history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 3. Agent Interaction (from agent.py)
# ============================================

@app.post("/api/agent/query", tags=["AI Agent"])
def query_agent(request: AgentQuery):
    """
    Ask the AI Agent a question.
    The agent uses LangChain with access to web search and financial tools.
    """
    try:
        input_message = {"messages": [{"role": "user", "content": request.query}]}
        config = {"configurable": {"thread_id": request.thread_id}, "recursion_limit": 12}
        
        if not configured():
            return {"response": fallback.answer(request.query), "thread_id": request.thread_id, "fallback": True}
        from agent import agent
        try:
            result = agent.invoke(input_message, config)
            response = content_text(result["messages"][-1].content)
        except Exception as error:
            logger.warning(f"AI agent failed, using built-in analyst: {error}")
            return {"response": fallback.answer(request.query), "thread_id": request.thread_id, "fallback": True}
        # Extract the last message conten
        return {
            "response": response,
            "thread_id": request.thread_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in agent query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 3.5 Symbol Search
@app.get("/api/search", tags=["Utility"])
def search_ticker(q: str = Query(..., min_length=1)):
    """
    Search for a ticker symbol by name or keyword.
    Returns a list of matching symbols with metadata.
    """
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": q, "quotesCount": 10, "newsCount": 0}
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        resp = requests.get(url, params=params, headers=headers, timeout=20)
        data = resp.json()
        
        results = []
        if "quotes" in data:
            for quote in data["quotes"]:
                 results.append({
                     "symbol": quote.get("symbol"),
                     "name": quote.get("shortname") or quote.get("longname"),
                     "exch": quote.get("exchange"),
                     "type": quote.get("quoteType")
                 })
        return {"count": len(results), "results": results}
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# 4. Master Combined Endpoint
# ============================================

@app.get("/api/dashboard/{ticker}", response_model=CombinedResponse, tags=["Dashboard"])
def get_dashboard_data(ticker: str):
    """
    Get ALL available data for a ticker in one call.
    Aggregates Analysis, News, and Market Regime (HSMM).
    
    Note: Market regime is based on S&P 500 (SPX) regardless of ticker queried,
    as it represents overall market conditions.
    """
    try:
        # 1. Stock Analysis
        try:
            analysis = details.get_complete_stock_analysis(ticker)
        except Exception as e:
            logger.warning(f"Dashboard partial failure (analysis): {e}")
            analysis = {"error": str(e)}

        # 2. News
        try:
            news = details.get_market_news(ticker, max_news=5)
        except Exception as e:
            logger.warning(f"Dashboard partial failure (news): {e}")
            news = {"error": str(e)}

        # 3. Market Regime (HSMM)
        try:
            regime = hsmm_api.get_market_condition()
        except Exception as e:
            logger.warning(f"Dashboard partial failure (regime): {e}")
            regime = {"error": str(e)}

        # 4. Forecast (HSMM Monte Carlo)
        try:
            forecast = hsmm_api.get_regime_forecast(horizon_days=30, n_simulations=1000)
        except Exception as e:
             logger.warning(f"Dashboard partial failure (forecast): {e}")
             forecast = {"error": str(e)}

        return {
            "ticker": ticker.upper(),
            "timestamp": datetime.now().isoformat(),
            "stock_analysis": analysis,
            "market_news": news,
            "market_regime": regime,
            "regime_forecast": forecast
        }

    except Exception as e:
        logger.error(f"Critical error in dashboard for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agent/market-brief", tags=["AI Agent"])
def market_brief(request: MarketBriefRequest):
    """Generate a short explanation grounded only in supplied market data."""
    try:
        prompt = f"""You are AlphaSharp's market explainer. Use only the JSON facts below.
Do not invent prices, dates, causes, or recommendations. Mention when evidence is missing.
Return 3 short sections: Current regime, Cross-asset read, What to watch.
Keep it under 180 words and call the forecast a scenario, not a prediction.

REGIME:\n{request.regime}
MACRO PULSE:\n{request.pulse}
HEADLINES:\n{request.headlines[:5]}"""
        if not configured():
            return {"brief": fallback.market_brief_text(request.regime, request.pulse, request.headlines),
                    "model": "built-in", "fallback": True, "as_of": datetime.now().isoformat()}
        response = details.model.invoke(prompt)
        return {"brief": content_text(response.content), "model": os.getenv('OPENROUTER_MODEL', 'openai/gpt-4.1-mini'), "as_of": datetime.now().isoformat()}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"AI market brief failed, using built-in analyst: {exc}")
        return {"brief": fallback.market_brief_text(request.regime, request.pulse, request.headlines),
                "model": "built-in", "fallback": True, "as_of": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)





