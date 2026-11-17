from fastapi import FastAPI

app = FastAPI(title="Droneverse Analysis")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "droneverse-analysis"}
