"""
FastAPI Server for LaTeX Resume Pipeline
Run with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.pdf_generator import router as pdf_router

app = FastAPI(
    title="JobEaseAI LaTeX Pipeline",
    description="Compiles structured JSON resume records into formatted PDFs using Tectonic and Jinja2.",
    version="1.0.0"
)

# CORS setup for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router, prefix="/api", tags=["LaTeX Compilation"])

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "JobEaseAI LaTeX Generator (FastAPI)",
        "compiler": "Tectonic"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
