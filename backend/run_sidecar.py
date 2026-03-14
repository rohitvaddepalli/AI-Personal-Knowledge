import argparse
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Second Brain FastAPI sidecar")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=31415)
    parser.add_argument("--data-dir", required=True)
    args = parser.parse_args()

    os.environ["SECOND_BRAIN_APP_DATA_DIR"] = args.data_dir
    os.environ["SECOND_BRAIN_API_HOST"] = args.host
    os.environ["SECOND_BRAIN_API_PORT"] = str(args.port)
    os.environ["SECOND_BRAIN_SIDECAR_MODE"] = "true"

    from app.main import app

    config = uvicorn.Config(
        app=app,
        host=args.host,
        port=args.port,
        log_level="warning",
        reload=False,
        access_log=False,
    )
    server = uvicorn.Server(config)
    app.state.uvicorn_server = server
    server.run()


if __name__ == "__main__":
    main()
