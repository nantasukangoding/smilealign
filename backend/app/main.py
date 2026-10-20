"""FastAPI app SmileAlign. Stateless; foto diproses di memori lalu selesai."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analyze
from app.segmentation import FORCE_MOCK, _model_available

app = FastAPI(title="SmileAlign API", version="0.1.0",
              description="Analisis posisi gigi + simulasi behel dari satu foto. "
                          "Estimasi edukatif, bukan diagnosis medis.")

_default_origins = ("http://localhost:3000,http://127.0.0.1:3000,"
                    "http://localhost:3100,http://127.0.0.1:3100")
origins = [o for o in os.environ.get("SMILEALIGN_CORS_ORIGINS", _default_origins).split(",")
           if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(analyze.router)


@app.get("/api/health")
def health():
    mode = "mock" if FORCE_MOCK == "1" else ("model" if _model_available() else "mock")
    return {"status": "ok", "mode": mode}
